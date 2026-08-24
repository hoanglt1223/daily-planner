import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { eq, and, gte, lte, desc, count, avg } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { users, taskSessions, tasks } from '../server/lib/db/schema.js';
import { requireAuth } from '../server/lib/auth-middleware.js';
import type { AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { action, id, taskId, from, to } = req.query;

  try {
    // GET /api/task-sessions?action=list&taskId=&from=&to=
    if (req.method === 'GET' && action === 'list') {
      const sessions = await db.query.taskSessions.findMany({
        where: and(
          eq(taskSessions.userId, user.sub),
          taskId ? eq(taskSessions.taskId, taskId as string) : undefined,
          from ? gte(taskSessions.startedAt, new Date(from as string)) : undefined,
          to ? lte(taskSessions.startedAt, new Date(to as string)) : undefined,
        ),
        with: {
          task: {
            columns: {
              id: true,
              title: true,
              estimatedMinutes: true,
            },
          },
        },
        orderBy: [desc(taskSessions.startedAt)],
        limit: 100,
      });
      res.json(sessions);
      return;
    }

    // GET /api/task-sessions?action=analytics&from=&to=
    if (req.method === 'GET' && action === 'analytics') {
      const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to as string) : new Date();

      const sessions = await db.query.taskSessions.findMany({
        where: and(
          eq(taskSessions.userId, user.sub),
          gte(taskSessions.startedAt, fromDate),
          lte(taskSessions.startedAt, toDate),
        ),
        with: {
          task: {
            columns: {
              id: true,
              title: true,
              estimatedMinutes: true,
            },
          },
        },
      });

      // Calculate analytics
      const completedSessions = sessions.filter(s => s.status === 'completed');
      const totalSessions = sessions.length;
      const completedCount = completedSessions.length;
      const totalPlannedMinutes = completedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
      const totalActualMinutes = completedSessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
      const avgSessionDuration = completedCount > 0 ? Math.round(totalActualMinutes / completedCount) : 0;

      // Estimation accuracy by task
      const taskAccuracy = new Map<string, { planned: number; actual: number; count: number }>();
      completedSessions.forEach(session => {
        const taskKey = session.taskId;
        const current = taskAccuracy.get(taskKey) || { planned: 0, actual: 0, count: 0 };
        current.planned += session.durationMinutes || 0;
        current.actual += session.actualMinutes || 0;
        current.count += 1;
        taskAccuracy.set(taskKey, current);
      });

      const taskAnalytics = Array.from(taskAccuracy.entries()).map(([taskId, data]) => ({
        taskId,
        taskTitle: sessions.find(s => s.taskId === taskId)?.task?.title ?? 'Unknown',
        plannedMinutes: data.planned,
        actualMinutes: data.actual,
        sessionCount: data.count,
        accuracyRatio: data.actual > 0 ? Math.round((data.planned / data.actual) * 100) : 0,
      })).sort((a, b) => b.sessionCount - a.sessionCount);

      // Daily breakdown
      const dailyBreakdown = new Map<string, { completed: number; totalMinutes: number }>();
      completedSessions.forEach(session => {
        const dateKey = new Date(session.startedAt).toISOString().split('T')[0];
        const current = dailyBreakdown.get(dateKey) || { completed: 0, totalMinutes: 0 };
        current.completed += 1;
        current.totalMinutes += session.actualMinutes || 0;
        dailyBreakdown.set(dateKey, current);
      });

      res.json({
        summary: {
          totalSessions,
          completedCount,
          completionRate: totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0,
          totalPlannedMinutes,
          totalActualMinutes,
          avgSessionDuration,
        },
        taskAnalytics,
        dailyBreakdown: Array.from(dailyBreakdown.entries())
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      });
      return;
    }

    // POST /api/task-sessions?action=create
    if (req.method === 'POST' && action === 'create') {
      const body = req.body;
      const session = await db.insert(taskSessions).values({
        userId: user.sub,
        taskId: body.taskId,
        durationMinutes: body.durationMinutes,
        focusPlaylistId: body.focusPlaylistId || null,
        status: 'in_progress',
        startedAt: new Date(),
      }).returning();

      res.json(session[0]);
      return;
    }

    // PATCH /api/task-sessions?action=complete&id=
    if (req.method === 'PATCH' && action === 'complete') {
      const body = req.body;
      const sessionId = id as string;

      const updated = await db.update(taskSessions)
        .set({
          status: 'completed',
          completedAt: new Date(),
          actualMinutes: body.actualMinutes,
          note: body.note || null,
        })
        .where(eq(taskSessions.id, sessionId))
        .returning();

      res.json(updated[0]);
      return;
    }

    // PATCH /api/task-sessions?action=abandon&id=
    if (req.method === 'PATCH' && action === 'abandon') {
      const sessionId = id as string;

      const updated = await db.update(taskSessions)
        .set({
          status: 'abandoned',
          completedAt: new Date().toISOString(),
          actualMinutes: 0,
        })
        .where(eq(taskSessions.id, sessionId))
        .returning();

      res.json(updated[0]);
      return;
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Task sessions API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
