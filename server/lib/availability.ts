import { and, eq, gte, lte, or } from 'drizzle-orm';
import { toZonedTime } from 'date-fns-tz';
import { db } from './db/client.js';
import { timeBlocks, bookings } from './db/schema.js';

const SLOT_MS = 30 * 60_000;
// Bookable window: 09:00–17:00, weekdays only — evaluated in the owner's timezone
// (not the server's UTC clock) so the window matches the owner's real working hours.
const BOOKING_START_HOUR = 9;
const BOOKING_END_HOUR = 17;

function isBookableSlot(d: Date, tz: string): boolean {
  const local = toZonedTime(d, tz);
  const day = local.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hour = local.getHours();
  return hour >= BOOKING_START_HOUR && hour < BOOKING_END_HOUR;
}

/**
 * Return all free 30-min slots for userId in [from, to].
 * "Busy" = existing time_blocks + pending bookings.
 * Only weekday slots between 09:00 and 17:00 (in the owner's timezone) are offered.
 */
export async function freeSlots(userId: string, from: Date, to: Date, tz = 'UTC'): Promise<Array<{ startAt: string; endAt: string }>> {
  const blocks = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, userId),
    gte(timeBlocks.endAt, from),
    lte(timeBlocks.startAt, to),
  ));

  const pendings = await db.select().from(bookings).where(and(
    eq(bookings.ownerUserId, userId),
    eq(bookings.status, 'pending'),
    gte(bookings.endAt, from),
    lte(bookings.startAt, to),
  ));

  const busy = [...blocks, ...pendings].map(x => ({
    s: new Date(x.startAt).getTime(),
    e: new Date(x.endAt).getTime(),
  }));

  const slots: Array<{ startAt: string; endAt: string }> = [];
  const cursor = new Date(from);
  while (cursor < to) {
    if (isBookableSlot(cursor, tz)) {
      const slotS = cursor.getTime();
      const slotE = slotS + SLOT_MS;
      const overlaps = busy.some(b => b.s < slotE && b.e > slotS);
      if (!overlaps) slots.push({
        startAt: new Date(slotS).toISOString(),
        endAt: new Date(slotE).toISOString(),
      });
    }
    cursor.setTime(cursor.getTime() + SLOT_MS);
  }
  return slots;
}

// silence unused
void or;
