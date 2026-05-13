import { and, eq, gte, lte, or } from 'drizzle-orm';
import { db } from './db/client.js';
import { timeBlocks, bookings } from './db/schema.js';

const SLOT_MS = 30 * 60_000;
const WORKDAY_START_HOUR = 6;
const WORKDAY_END_HOUR = 22;

/**
 * Return all free 30-min slots for userId in [from, to].
 * "Busy" = existing time_blocks + pending bookings.
 */
export async function freeSlots(userId: string, from: Date, to: Date): Promise<Array<{ startAt: string; endAt: string }>> {
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
    const hour = cursor.getHours();
    if (hour >= WORKDAY_START_HOUR && hour < WORKDAY_END_HOUR) {
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
