import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** Resolve the browser's IANA timezone, falling back to UTC. */
function resolveBrowserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Active timezone for all wall-clock math + display. Defaults to the browser's
 * timezone (correct for almost everyone) and is overridden with the signed-in
 * user's saved profile timezone once known (see setActiveTimeZone). This avoids
 * the old bug where a hardcoded 'Asia/Bangkok' default mis-computed day/week
 * boundaries for users in other timezones.
 */
let activeTimeZone = resolveBrowserTz();

/** Override the active timezone (e.g. from the user's saved profile). */
export function setActiveTimeZone(tz: string): void {
  if (tz) activeTimeZone = tz;
}

/** The timezone currently used for day boundaries + display. */
export function getActiveTimeZone(): string {
  return activeTimeZone;
}

/**
 * All "day boundary" helpers below are TZ-aware. They return Date objects whose
 * underlying UTC value represents the requested moment in the user's TZ, so
 * (a) the math is independent of the browser's local timezone, and
 * (b) subtracting UTC milliseconds from a block's startAt gives correct
 *     minutes-since-midnight regardless of where the browser runs.
 */

/** Midnight (00:00) of the given date, interpreted in `tz`. */
export function startOfDay(date: Date, tz: string = getActiveTimeZone()): Date {
  const dateIso = formatInTimeZone(date, tz, 'yyyy-MM-dd');
  return fromZonedTime(`${dateIso}T00:00:00`, tz);
}

/** End of day (23:59:59.999) of the given date, interpreted in `tz`. */
export function endOfDay(date: Date, tz: string = getActiveTimeZone()): Date {
  const dateIso = formatInTimeZone(date, tz, 'yyyy-MM-dd');
  return fromZonedTime(`${dateIso}T23:59:59.999`, tz);
}

/** Monday 00:00 of the week containing the given date, in `tz`. */
export function startOfWeek(date: Date, tz: string = getActiveTimeZone()): Date {
  // Get the day-of-week as it reads in tz, without relying on Date setters.
  const weekday = formatInTimeZone(date, tz, 'i'); // ISO day 1..7 (Mon..Sun)
  const monOffset = Number(weekday) - 1;
  const day = startOfDay(date, tz);
  return new Date(day.getTime() - monOffset * 86_400_000);
}

/** Add `n` whole days. Pure UTC arithmetic — safe for any TZ. */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86_400_000);
}

export function addMinutes(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 60_000);
}

export function fmtDay(date: Date, tz: string = getActiveTimeZone()): string {
  return formatInTimeZone(date, tz, 'EEE dd/MM');
}

export function fmtHour(date: Date, tz: string = getActiveTimeZone()): string {
  return formatInTimeZone(date, tz, 'HH:mm');
}

export function fmtIsoDate(date: Date, tz: string = getActiveTimeZone()): string {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

/** Build a Date at user-TZ wall-clock yyyy-MM-dd HH:mm. */
export function fromWallClock(dateIso: string, hhmm: string, tz: string = getActiveTimeZone()): Date {
  return fromZonedTime(`${dateIso}T${hhmm}:00`, tz);
}

/** Minutes-since-midnight of a Date as it reads in `tz`. */
export function minutesSinceMidnight(date: Date, tz: string = getActiveTimeZone()): number {
  const hhmm = formatInTimeZone(date, tz, 'HH:mm');
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

export const WORKDAY_START_HOUR = 6;
export const WORKDAY_END_HOUR = 22;
export const SLOT_MINUTES = 30;

// Capacity baseline for "free time" math; distinct from the planner's display hour range.
export const WORKDAY_HOURS = 8;
