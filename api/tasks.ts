import type { VercelResponse } from '@vercel/node';
import { and, eq, or, gte, lt } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { tasks } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

// ─── Smart-view date helpers ──────────────────────────────────────────────

function todayUtcRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function upcomingEnd(): Date {
  const { start } = todayUtcRange();
  return new Date(start.getTime() + 7 * 86_400_000);
}

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const id = req.query.id ? String(req.query.id) : null;

  try {
    if (req.method === 'GET' && !id) {
      // Optional query params for smart views + label filter
      const view = req.query.view ? String(req.query.view) : null; // today | upcoming | overdue
      const labelFilter = req.query.label ? String(req.query.label) : null;

      let whereClause = eq(tasks.userId, user.sub);

      if (view === 'today') {
        const { start, end } = todayUtcRange();
        whereClause = and(
          eq(tasks.userId, user.sub),
          gte(tasks.dueDate, start),
          lt(tasks.dueDate, end),
        )!;
      } else if (view === 'upcoming') {
        const { end: todayEnd } = todayUtcRange();
        const upEnd = upcomingEnd();
        whereClause = and(
          eq(tasks.userId, user.sub),
          gte(tasks.dueDate, todayEnd),
          lt(tasks.dueDate, upEnd),
        )!;
      } else if (view === 'overdue') {
        const { start: todayStart } = todayUtcRange();
        whereClause = and(
          eq(tasks.userId, user.sub),
          lt(tasks.dueDate, todayStart),
          or(
            eq(tasks.status, 'todo'),
            eq(tasks.status, 'doing'),
            eq(tasks.status, 'backlog'),
          ),
        )!;
      }

      let rows = await db.select().from(tasks).where(whereClause);

      // Label filtering is done in JS since jsonb array-contains is driver-specific.
      // At current task volumes (personal planner) this is negligible overhead.
      if (labelFilter) {
        rows = rows.filter(t => Array.isArray(t.labels) && t.labels.includes(labelFilter));
      }

      return res.status(200).json(rows);
    }

    if (req.method === 'POST' && !id) {
      const body = req.body ?? {};
      if (!body.title) return res.status(400).json({ error: 'title_required' });
      const [row] = await db.insert(tasks).values({
        userId: user.sub,
        title: body.title,
        description: body.description ?? null,
        categoryId: body.categoryId ?? null,
        status: body.status ?? 'todo',
        priority: body.priority ?? 3,
        estimatedMinutes: body.estimatedMinutes ?? 60,
        recurringRule: body.recurringRule ?? null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        subtasks: body.subtasks ?? [],
        labels: Array.isArray(body.labels) ? body.labels : [],
        reminderEnabled: body.reminderEnabled ?? false,
        reminderMinutes: body.reminderMinutes ?? null,
      }).returning();
      return res.status(201).json(row);
    }

    if (req.method === 'PATCH' && id) {
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of ['title', 'description', 'status', 'priority', 'estimatedMinutes', 'categoryId', 'recurringRule', 'isPinned', 'subtasks', 'reminderEnabled', 'reminderMinutes']) {
        if (key in body) patch[key] = body[key];
      }
      if ('dueDate' in body) patch.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      // labels: validate it's a string array before persisting
      if ('labels' in body) {
        patch.labels = Array.isArray(body.labels)
          ? body.labels.filter((l: unknown) => typeof l === 'string')
          : [];
      }
      const [row] = await db.update(tasks)
        .set(patch)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.sub)))
        .returning();
      if (!row) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(row);
    }

    if (req.method === 'DELETE' && id) {
      await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.sub)));
      return res.status(204).end();
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}
