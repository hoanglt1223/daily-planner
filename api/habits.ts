import type { VercelResponse } from '@vercel/node';
import { and, eq, desc, gte, lte } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { habits, habitEntries } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  const action = req.query.action ? String(req.query.action) : null;
  const habitId = req.query.id ? String(req.query.id) : null;

  try {
    // GET habits or entries
    if (req.method === 'GET') {
      if (action === 'entries') {
        const targetHabitId = req.query.habitId ? String(req.query.habitId) : null;
        const from = req.query.from ? String(req.query.from) : null;
        const to = req.query.to ? String(req.query.to) : null;

        if (!targetHabitId) {
          return res.status(400).json({ error: 'habitId required' });
        }

        let query = db.select().from(habitEntries).where(eq(habitEntries.habitId, targetHabitId));

        if (from) {
          query = db.select().from(habitEntries).where(
            and(
              eq(habitEntries.habitId, targetHabitId),
              gte(habitEntries.entryDate, new Date(from))
            )
          );
        }
        if (to) {
          const baseQuery = from ? db.select().from(habitEntries).where(
            and(
              eq(habitEntries.habitId, targetHabitId),
              gte(habitEntries.entryDate, new Date(from))
            )
          ) : db.select().from(habitEntries).where(eq(habitEntries.habitId, targetHabitId));
          query = db.select().from(habitEntries).where(
            and(
              eq(habitEntries.habitId, targetHabitId),
              lte(habitEntries.entryDate, new Date(to))
            )
          );
        }

        const entries = await query.orderBy(desc(habitEntries.entryDate));
        return res.status(200).json(entries);
      }

      // Get all habits with entries
      const userHabits = await db.select().from(habits)
        .where(eq(habits.userId, user.sub))
        .orderBy(desc(habits.createdAt));

      const habitIds = userHabits.map(h => h.id);
      const allEntries = habitIds.length > 0
        ? await db.select().from(habitEntries).where(eq(habitEntries.userId, user.sub))
        : [];

      const habitsWithEntries = userHabits.map(habit => ({
        ...habit,
        entries: allEntries.filter(e => e.habitId === habit.id),
      }));

      return res.status(200).json(habitsWithEntries);
    }

    // POST new habit or toggle entry
    if (req.method === 'POST') {
      const body = req.body ?? {};

      if (action === 'toggle') {
        const { habitId: targetHabitId, entryDate, completed, note } = body;

        if (!targetHabitId || !entryDate) {
          return res.status(400).json({ error: 'habitId and entryDate required' });
        }

        const existing = await db.select().from(habitEntries)
          .where(
            and(
              eq(habitEntries.habitId, targetHabitId),
              eq(habitEntries.entryDate, new Date(entryDate))
            )
          )
          .limit(1);

        if (existing.length > 0) {
          const updated = await db.update(habitEntries)
            .set({
              completed: completed !== undefined ? completed : !existing[0].completed,
              note: note !== undefined ? note : existing[0].note,
              updatedAt: new Date(),
            })
            .where(eq(habitEntries.id, existing[0].id))
            .returning();

          return res.status(200).json(updated[0]);
        } else {
          const created = await db.insert(habitEntries)
            .values({
              habitId: targetHabitId,
              userId: user.sub,
              entryDate: new Date(entryDate),
              completed: completed !== undefined ? completed : true,
              note: note || null,
            })
            .returning();

          return res.status(201).json(created[0]);
        }
      }

      // Create new habit
      if (!body.name) {
        return res.status(400).json({ error: 'name_required' });
      }

      const [newHabit] = await db.insert(habits)
        .values({
          userId: user.sub,
          name: body.name,
          description: body.description || null,
          frequency: body.frequency || 'daily',
          targetDays: body.targetDays || [],
          color: body.color || '#10b981',
          icon: body.icon || '✓',
          targetPerPeriod: body.targetPerPeriod || 1,
        })
        .returning();

      return res.status(201).json(newHabit);
    }

    // PATCH habit
    if (req.method === 'PATCH' && habitId) {
      const body = req.body ?? {};

      const [updated] = await db.update(habits)
        .set({
          name: body.name,
          description: body.description !== undefined ? body.description : undefined,
          frequency: body.frequency,
          targetDays: body.targetDays,
          color: body.color,
          icon: body.icon,
          targetPerPeriod: body.targetPerPeriod,
          updatedAt: new Date(),
        })
        .where(and(eq(habits.id, habitId), eq(habits.userId, user.sub)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'not_found' });
      }

      return res.status(200).json(updated);
    }

    // DELETE habit
    if (req.method === 'DELETE' && habitId) {
      await db.delete(habitEntries).where(eq(habitEntries.habitId, habitId));
      await db.delete(habits).where(and(eq(habits.id, habitId), eq(habits.userId, user.sub)));
      return res.status(204).end();
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}
