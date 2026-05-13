import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tasks, timeBlocks, users } from '../db/schema.js';
import { expand, type RecurringRule } from './expand.js';

const HORIZON_DAYS = 21;

/**
 * Ensure recurring tasks have time_blocks materialized up to today + HORIZON_DAYS.
 * Idempotent thanks to unique (taskId, startAt). Safe to call on every read.
 */
export async function materializeIfStale(userId: string): Promise<void> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return;

  const horizonEnd = new Date(); horizonEnd.setUTCHours(0, 0, 0, 0);
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + HORIZON_DAYS);

  if (u.materializedUntil && u.materializedUntil.getTime() >= horizonEnd.getTime()) return;

  const from = u.materializedUntil ?? new Date();
  const recurring = await db.select().from(tasks).where(and(
    eq(tasks.userId, userId),
    isNotNull(tasks.recurringRule),
  ));

  for (const t of recurring) {
    const rule = t.recurringRule as RecurringRule | null;
    if (!rule) continue;
    const occs = expand(rule, from, horizonEnd, u.timezone);
    for (const o of occs) {
      try {
        await db.insert(timeBlocks).values({
          userId,
          taskId: t.id,
          title: t.title,
          startAt: o.start,
          endAt: o.end,
          status: 'planned',
        }).onConflictDoNothing();
      } catch (e) {
        // unique-constraint conflicts are expected and ignored
        console.warn('materialize conflict', e);
      }
    }
  }

  await db.update(users)
    .set({ materializedUntil: horizonEnd })
    .where(eq(users.id, userId));
}

/**
 * Wipe future planned blocks for a task after its recurringRule changes.
 * Keeps past + completed/in_progress untouched.
 */
export async function clearFutureRecurringBlocks(taskId: string): Promise<void> {
  await db.delete(timeBlocks).where(and(
    eq(timeBlocks.taskId, taskId),
    eq(timeBlocks.status, 'planned'),
    sql`${timeBlocks.startAt} > now()`,
  ));
}
