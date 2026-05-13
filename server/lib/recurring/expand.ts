import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';

export type RecurringRule = {
  freq: 'daily' | 'weekly' | 'monthly';
  byDay?: string[]; // MO TU WE TH FR SA SU
  interval?: number;
  until?: string;
  defaultTime?: string;            // 'HH:MM' in user TZ
  defaultDurationMinutes?: number; // length of each block
};

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Expand a recurring rule into concrete occurrences inside [from, to].
 * All math performed in the user's TZ to keep wall-clock semantics stable.
 */
export function expand(rule: RecurringRule, from: Date, to: Date, tz: string): Array<{ start: Date; end: Date }> {
  const interval = Math.max(1, rule.interval ?? 1);
  const durationMin = rule.defaultDurationMinutes ?? 60;
  const [hh, mm] = (rule.defaultTime ?? '09:00').split(':').map(Number);
  const untilTs = rule.until ? new Date(rule.until).getTime() : Number.POSITIVE_INFINITY;
  const out: Array<{ start: Date; end: Date }> = [];

  const fromZ = toZonedTime(from, tz);
  const toZ = toZonedTime(to, tz);

  if (rule.freq === 'daily') {
    const cursor = new Date(fromZ);
    cursor.setHours(hh, mm, 0, 0);
    let stepDay = 0;
    while (cursor <= toZ) {
      if (stepDay % interval === 0) pushIfInRange(out, cursor, durationMin, untilTs, tz);
      cursor.setDate(cursor.getDate() + 1);
      stepDay++;
    }
    return out;
  }

  if (rule.freq === 'weekly') {
    const days = (rule.byDay && rule.byDay.length > 0 ? rule.byDay : ['MO']).map(d => DAY_CODES.indexOf(d));
    const cursor = new Date(fromZ);
    cursor.setHours(hh, mm, 0, 0);
    while (cursor <= toZ) {
      if (days.includes(cursor.getDay())) {
        pushIfInRange(out, cursor, durationMin, untilTs, tz);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  if (rule.freq === 'monthly') {
    const cursor = new Date(fromZ);
    cursor.setHours(hh, mm, 0, 0);
    while (cursor <= toZ) {
      pushIfInRange(out, cursor, durationMin, untilTs, tz);
      cursor.setMonth(cursor.getMonth() + interval);
    }
    return out;
  }

  return out;
}

function pushIfInRange(
  out: Array<{ start: Date; end: Date }>,
  zoned: Date,
  durationMin: number,
  untilTs: number,
  tz: string,
) {
  const iso = formatInTimeZone(zoned, tz, "yyyy-MM-dd'T'HH:mm:ss");
  const start = fromZonedTime(iso, tz);
  if (start.getTime() > untilTs) return;
  const end = new Date(start.getTime() + durationMin * 60_000);
  out.push({ start, end });
}
