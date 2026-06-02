import type { VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { categories } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;
  const id = req.query.id ? String(req.query.id) : null;

  try {
    if (req.method === 'GET' && !id) {
      const rows = await db.select().from(categories).where(eq(categories.userId, user.sub));
      return res.status(200).json(rows);
    }
    if (req.method === 'POST' && !id) {
      const body = req.body ?? {};
      if (!body.name) return res.status(400).json({ error: 'name_required' });
      const [row] = await db.insert(categories).values({
        userId: user.sub,
        name: body.name,
        color: body.color ?? '#6366f1',
      }).returning();
      return res.status(201).json(row);
    }
    if (req.method === 'PATCH' && id) {
      const body = req.body ?? {};
      const [row] = await db.update(categories)
        .set(body)
        .where(and(eq(categories.id, id), eq(categories.userId, user.sub)))
        .returning();
      if (!row) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(row);
    }
    if (req.method === 'DELETE' && id) {
      await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.sub)));
      return res.status(204).end();
    }
    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}
