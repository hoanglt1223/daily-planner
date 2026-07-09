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
    // GET habits or entries or insights
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

      if (action === 'insights') {
        const targetHabitId = req.query.habitId ? String(req.query.habitId) : null;
        const days = req.query.days ? parseInt(String(req.query.days)) : 30;

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        fromDate.setHours(0, 0, 0, 0);

        let targetHabits = [];
        if (targetHabitId) {
          const habitData = await db.select().from(habits)
            .where(and(eq(habits.id, targetHabitId), eq(habits.userId, user.sub)))
            .limit(1);
          if (habitData.length === 0) {
            return res.status(404).json({ error: 'habit_not_found' });
          }
          targetHabits = habitData;
        } else {
          targetHabits = await db.select().from(habits)
            .where(eq(habits.userId, user.sub));
        }

        const habitIds = targetHabits.map(h => h.id);
        const relevantEntries = habitIds.length > 0
          ? await db.select().from(habitEntries)
              .where(
                and(
                  eq(habitEntries.userId, user.sub),
                  gte(habitEntries.entryDate, fromDate)
                )
              )
          : [];

        const insights = targetHabits.map(habit => {
          const habitEntries = relevantEntries.filter(e => e.habitId === habit.id);
          const completedEntries = habitEntries.filter(e => e.completed);

          // Calculate streaks
          const sortedEntries = [...habitEntries].sort((a, b) =>
            new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
          );

          let currentStreak = 0;
          let longestStreak = 0;
          let tempStreak = 0;
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Calculate current and longest streak
          for (let i = sortedEntries.length - 1; i >= 0; i--) {
            const entry = sortedEntries[i];
            const entryDate = new Date(entry.entryDate);
            entryDate.setHours(0, 0, 0, 0);

            if (entry.completed) {
              tempStreak++;
              // Check if this entry is consecutive with the next one
              if (i < sortedEntries.length - 1) {
                const nextDate = new Date(sortedEntries[i + 1].entryDate);
                nextDate.setHours(0, 0, 0, 0);
                const dayDiff = (entryDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24);
                if (dayDiff !== 1) {
                  longestStreak = Math.max(longestStreak, tempStreak);
                  tempStreak = 1;
                }
              }

              // Update current streak (consecutive from today backwards)
              const daysFromToday = (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
              if (daysFromToday === currentStreak) {
                currentStreak++;
              }
            } else {
              longestStreak = Math.max(longestStreak, tempStreak);
              tempStreak = 0;
            }
          }
          longestStreak = Math.max(longestStreak, tempStreak);

          // Best day of week
          const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
          const dayOfWeekCompleted = [0, 0, 0, 0, 0, 0, 0];

          habitEntries.forEach(entry => {
            const dayOfWeek = new Date(entry.entryDate).getDay();
            dayOfWeekCounts[dayOfWeek]++;
            if (entry.completed) {
              dayOfWeekCompleted[dayOfWeek]++;
            }
          });

          const completionRates = dayOfWeekCounts.map((total, idx) =>
            total > 0 ? (dayOfWeekCompleted[idx] / total) * 100 : 0
          );
          const bestDayIndex = completionRates.indexOf(Math.max(...completionRates));
          const bestDay = bestDayIndex >= 0 ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bestDayIndex] : null;
          const bestDayRate = completionRates[bestDayIndex];

          // Trend (last 7 days vs previous 7 days)
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const fourteenDaysAgo = new Date(today);
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

          const recentEntries = habitEntries.filter(e => new Date(e.entryDate) >= sevenDaysAgo);
          const olderEntries = habitEntries.filter(e => {
            const d = new Date(e.entryDate);
            return d >= fourteenDaysAgo && d < sevenDaysAgo;
          });

          const recentRate = recentEntries.length > 0
            ? (recentEntries.filter(e => e.completed).length / recentEntries.length) * 100
            : 0;
          const olderRate = olderEntries.length > 0
            ? (olderEntries.filter(e => e.completed).length / olderEntries.length) * 100
            : 0;
          const trend = recentRate - olderRate;

          return {
            habitId: habit.id,
            habitName: habit.name,
            currentStreak,
            longestStreak,
            totalEntries: habitEntries.length,
            completedEntries: completedEntries.length,
            completionRate: habitEntries.length > 0
              ? Math.round((completedEntries.length / habitEntries.length) * 100)
              : 0,
            bestDay: bestDay || 'N/A',
            bestDayRate: bestDayRate ? Math.round(bestDayRate) : 0,
            trend: Math.round(trend),
            lastDays: days,
          };
        });

        // If single habit, return single object, else return array
        return res.status(200).json(targetHabitId ? insights[0] : insights);
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
