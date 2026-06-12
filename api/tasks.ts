import type { VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { tasks } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const id = req.query.id ? String(req.query.id) : null;

  try {
    if (req.method === 'GET' && !id) {
      const rows = await db.select().from(tasks).where(eq(tasks.userId, user.sub));
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
      }).returning();
      return res.status(201).json(row);
    }
    if (req.method === 'PATCH' && id) {
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of ['title', 'description', 'status', 'priority', 'estimatedMinutes', 'categoryId', 'recurringRule', 'isPinned']) {
        if (key in body) patch[key] = body[key];
      }
      if ('dueDate' in body) patch.dueDate = body.dueDate ? new Date(body.dueDate) : null;
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
