import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const DEFAULT_TZ = 'Asia/Bangkok';

export function startOfWeek(date: Date, tz: string = DEFAULT_TZ): Date {
  const zoned = toZonedTime(date, tz);
  const day = zoned.getDay();
  const monOffset = (day + 6) % 7;
  zoned.setDate(zoned.getDate() - monOffset);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, tz);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}

export function addMinutes(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 60_000);
}

export function fmtDay(date: Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, 'EEE dd/MM');
}

export function fmtHour(date: Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, 'HH:mm');
}

export function fmtIsoDate(date: Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

/** Build a Date at user-TZ wall-clock yyyy-MM-dd HH:mm. */
export function fromWallClock(dateIso: string, hhmm: string, tz: string = DEFAULT_TZ): Date {
  return fromZonedTime(`${dateIso}T${hhmm}:00`, tz);
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export const WORKDAY_START_HOUR = 6;
export const WORKDAY_END_HOUR = 22;
export const SLOT_MINUTES = 30;
