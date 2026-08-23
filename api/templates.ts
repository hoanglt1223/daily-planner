import type { VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { taskTemplates } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const id = req.query.id ? String(req.query.id) : null;

  try {
    if (req.method === 'GET' && !id) {
      const rows = await db.select().from(taskTemplates).where(eq(taskTemplates.userId, user.sub));
      return res.status(200).json(rows);
    }
    if (req.method === 'POST' && !id) {
      const body = req.body ?? {};
      if (!body.name || !body.defaultTitle) {
        return res.status(400).json({ error: 'name_and_title_required' });
      }
      const [row] = await db.insert(taskTemplates).values({
        userId: user.sub,
        name: body.name,
        description: body.description ?? null,
        defaultCategoryId: body.defaultCategoryId ?? null,
        defaultTitle: body.defaultTitle,
        defaultDescription: body.defaultDescription ?? null,
        defaultEstimatedMinutes: body.defaultEstimatedMinutes ?? 60,
        defaultPriority: body.defaultPriority ?? 3,
        defaultStatus: body.defaultStatus ?? 'todo',
        defaultRecurringRule: body.defaultRecurringRule ?? null,
        defaultLabels: body.defaultLabels ?? [],
        defaultSubtasks: body.defaultSubtasks ?? [],
        isPinned: body.isPinned ?? false,
        variables: body.variables ?? [],
      }).returning();
      return res.status(201).json(row);
    }
    if (req.method === 'PATCH' && id) {
      const body = req.body ?? {};
      const [row] = await db.update(taskTemplates)
        .set({ ...body, updatedAt: new Date().toISOString() })
        .where(and(eq(taskTemplates.id, id), eq(taskTemplates.userId, user.sub)))
        .returning();
      if (!row) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(row);
    }
    if (req.method === 'DELETE' && id) {
      await db.delete(taskTemplates).where(and(eq(taskTemplates.id, id), eq(taskTemplates.userId, user.sub)));
      return res.status(204).end();
    }
    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}
