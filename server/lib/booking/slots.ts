/**
 * Slot generation for the Calendly-style booking system.
 * Computes valid future slots given an event type, owner availability rules,
 * and existing busy time (blocks + bookings). All window math is done in the
 * owner's IANA timezone.
 */
import { and, eq, gte, lte } from 'drizzle-orm';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { db } from '../db/client.js';
import { timeBlocks, bookings, bookingAvailability } from '../db/schema.js';

export interface SlotEntry {
  startAt: string;
  endAt: string;
}

export interface SlotsOptions {
  userId: string;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
  tz: string;
  /** If provided, only generate slots in this range (overrides horizonDays). */
  from?: Date;
  to?: Date;
}

/**
 * Return all free slots for the given event type duration within the owner's
 * availability windows. Busy = existing time_blocks + pending/approved bookings.
 * Buffer is applied AFTER each booking slot so back-to-back bookings have breathing room.
 */
export async function freeSlotsV2(opts: SlotsOptions): Promise<SlotEntry[]> {
  const {
    userId, durationMinutes, bufferMinutes, minNoticeMinutes,
    horizonDays, tz,
  } = opts;

  const now = new Date();
  const earliest = new Date(now.getTime() + minNoticeMinutes * 60_000);
  const from = opts.from ?? earliest;
  const to = opts.to ?? new Date(now.getTime() + horizonDays * 24 * 60 * 60_000);

  // Fetch availability rules for owner.
  const availRows = await db.select().from(bookingAvailability)
    .where(eq(bookingAvailability.ownerUserId, userId));

  // No availability configured: return empty.
  if (availRows.length === 0) return [];

  // Build a map: weekday -> [{startMinute, endMinute}]
  const availByDay = new Map<number, Array<{ s: number; e: number }>>();
  for (const row of availRows) {
    const list = availByDay.get(row.weekday) ?? [];
    list.push({ s: row.startMinute, e: row.endMinute });
    availByDay.set(row.weekday, list);
  }

  // Fetch busy intervals (time_blocks + pending/approved bookings) within window.
  const searchFrom = from < earliest ? earliest : from;
  const [blocks, bks] = await Promise.all([
    db.select({ startAt: timeBlocks.startAt, endAt: timeBlocks.endAt })
      .from(timeBlocks)
      .where(and(
        eq(timeBlocks.userId, userId),
        gte(timeBlocks.endAt, searchFrom),
        lte(timeBlocks.startAt, to),
      )),
    db.select({ startAt: bookings.startAt, endAt: bookings.endAt, status: bookings.status })
      .from(bookings)
      .where(and(
        eq(bookings.ownerUserId, userId),
        gte(bookings.endAt, searchFrom),
        lte(bookings.startAt, to),
      )),
  ]);

  // Busy intervals include the buffer after each booking.
  const busyMs: Array<{ s: number; e: number }> = [];
  for (const b of blocks) {
    busyMs.push({ s: new Date(b.startAt).getTime(), e: new Date(b.endAt).getTime() });
  }
  for (const b of bks) {
    if (b.status === 'cancelled' || b.status === 'rejected') continue;
    const s = new Date(b.startAt).getTime();
    const e = new Date(b.endAt).getTime();
    // Buffer extends the busy window after this booking.
    busyMs.push({ s, e: e + bufferMinutes * 60_000 });
  }

  const durationMs = durationMinutes * 60_000;
  const slots: SlotEntry[] = [];

  // Step through days in the horizon.
  const dayStart = startOfDayInTz(searchFrom < from ? from : searchFrom, tz);
  const dayEnd = to;

  let day = dayStart;
  while (day < dayEnd) {
    const localDay = toZonedTime(day, tz);
    const weekday = localDay.getDay(); // 0 = Sunday
    const windows = availByDay.get(weekday);
    if (windows) {
      for (const win of windows) {
        // Compute UTC timestamps for window start and end on this specific day.
        const winStart = minuteOffsetToUtc(day, win.s, tz);
        const winEnd = minuteOffsetToUtc(day, win.e, tz);

        // Step through slots.
        let cursor = winStart;
        while (cursor.getTime() + durationMs <= winEnd.getTime()) {
          const slotS = cursor.getTime();
          const slotE = slotS + durationMs;

          // Skip slots before our earliest booking time.
          if (slotS < earliest.getTime()) {
            cursor = new Date(cursor.getTime() + durationMs);
            continue;
          }

          const overlaps = busyMs.some(b => b.s < slotE && b.e > slotS);
          if (!overlaps) {
            slots.push({
              startAt: new Date(slotS).toISOString(),
              endAt: new Date(slotE).toISOString(),
            });
          }
          cursor = new Date(cursor.getTime() + durationMs);
        }
      }
    }
    // Next day.
    day = new Date(day.getTime() + 24 * 60 * 60_000);
  }

  return slots;
}

/** Return UTC Date for midnight of the given date in the specified timezone. */
function startOfDayInTz(date: Date, tz: string): Date {
  const dateStr = formatInTimeZone(date, tz, 'yyyy-MM-dd');
  return fromZonedTime(`${dateStr}T00:00:00`, tz);
}

/** Convert a minute-offset-from-midnight into a UTC Date for the given day. */
function minuteOffsetToUtc(dayMidnightUtc: Date, minutes: number, tz: string): Date {
  const dayStr = formatInTimeZone(dayMidnightUtc, tz, 'yyyy-MM-dd');
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return fromZonedTime(`${dayStr}T${hh}:${mm}:00`, tz);
}

