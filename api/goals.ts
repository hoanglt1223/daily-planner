import type { VercelResponse } from '@vercel/node';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { goals, timeBlocks, tasks, habitEntries } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const id = req.query.id ? String(req.query.id) : null;
  const action = req.query.action ? String(req.query.action) : null;

  try {
    // GET all goals or single goal
    if (req.method === 'GET' && !action) {
      if (id) {
        const [goal] = await db.select().from(goals)
          .where(and(eq(goals.id, id), eq(goals.userId, user.sub)));
        if (!goal) return res.status(404).json({ error: 'not_found' });
        return res.status(200).json(goal);
      }

      const rows = await db.select().from(goals)
        .where(eq(goals.userId, user.sub))
        .orderBy(desc(goals.createdAt));
      return res.status(200).json(rows);
    }

    // GET goal progress calculation
    if (req.method === 'GET' && action === 'progress') {
      if (!id) return res.status(400).json({ error: 'goal_id_required' });

      const [goal] = await db.select().from(goals)
        .where(and(eq(goals.id, id), eq(goals.userId, user.sub)));
      if (!goal) return res.status(404).json({ error: 'not_found' });

      // Calculate progress from linked tasks
      let taskProgress = 0;
      if (goal.linkedTaskIds && goal.linkedTaskIds.length > 0) {
        const completedTasks = await db.select().from(tasks)
          .where(and(
            eq(tasks.userId, user.sub),
            eq(tasks.status, 'done')
          ));
        taskProgress = completedTasks.filter(t => goal.linkedTaskIds?.includes(t.id)).length;
      }

      // Calculate progress from linked habits (last 30 days)
      let habitProgress = 0;
      if (goal.linkedHabitIds && goal.linkedHabitIds.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const entries = await db.select().from(habitEntries)
          .where(and(
            eq(habitEntries.userId, user.sub),
            eq(habitEntries.completed, true)
          ));
        habitProgress = entries.filter(e =>
          goal.linkedHabitIds?.includes(e.habitId) &&
          new Date(e.entryDate) >= thirtyDaysAgo
        ).length;
      }

      return res.status(200).json({
        goalId: goal.id,
        targetValue: goal.targetValue,
        currentValue: goal.currentValue,
        taskProgress,
        habitProgress,
        progressPercent: Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
      });
    }

    // POST new goal
    if (req.method === 'POST' && !id) {
      const body = req.body ?? {};
      if (!body.title) return res.status(400).json({ error: 'title_required' });
      if (!body.targetValue) return res.status(400).json({ error: 'target_value_required' });
      if (!body.startDate) return res.status(400).json({ error: 'start_date_required' });
      if (!body.endDate) return res.status(400).json({ error: 'end_date_required' });

      const [row] = await db.insert(goals).values({
        userId: user.sub,
        title: body.title,
        description: body.description,
        period: body.period ?? 'quarterly',
        status: 'active',
        targetValue: body.targetValue,
        currentValue: body.currentValue ?? 0,
        unit: body.unit,
        color: body.color ?? '#3b82f6',
        category: body.category,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        linkedTaskIds: body.linkedTaskIds ?? [],
        linkedHabitIds: body.linkedHabitIds ?? [],
      }).returning();
      return res.status(201).json(row);
    }

    // PATCH update goal
    if (req.method === 'PATCH' && id) {
      const body = req.body ?? {};

      // Handle progress update
      if (body.currentValue !== undefined) {
        const [existing] = await db.select().from(goals)
          .where(and(eq(goals.id, id), eq(goals.userId, user.sub)));
        if (!existing) return res.status(404).json({ error: 'not_found' });

        // Auto-update status based on progress
        let newStatus = existing.status;
        if (body.currentValue >= existing.targetValue && newStatus === 'active') {
          newStatus = 'completed';
        } else if (body.currentValue < existing.targetValue && newStatus === 'completed') {
          newStatus = 'active';
        }

        body.status = newStatus;
      }

      const [row] = await db.update(goals)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(goals.id, id), eq(goals.userId, user.sub)))
        .returning();
      if (!row) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(row);
    }

    // DELETE goal
    if (req.method === 'DELETE' && id) {
      await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, user.sub)));
      return res.status(204).end();
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}