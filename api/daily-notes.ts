import type { VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { dailyNotes } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    // GET /api/daily-notes?date=2025-01-15
    if (req.method === 'GET') {
      const dateStr = req.query.date ? String(req.query.date) : null;
      if (!dateStr) return res.status(400).json({ error: 'date_required' });

      const noteDate = new Date(dateStr + 'T00:00:00');
      const row = await db.select().from(dailyNotes).where(
        and(eq(dailyNotes.userId, user.sub), eq(dailyNotes.noteDate, noteDate)),
      ).limit(1);

      return res.status(200).json(row[0] ?? { content: '', noteDate: dateStr });
    }

    // PUT /api/daily-notes  (upsert by date)
    if (req.method === 'PUT') {
      const body = req.body ?? {};
      if (!body.date) return res.status(400).json({ error: 'date_required' });

      const noteDate = new Date(body.date + 'T00:00:00');
      const content = body.content ?? '';
      const reflectionData = body.reflectionData ?? null;

      // Try to find existing note for this date
      const existing = await db.select().from(dailyNotes).where(
        and(eq(dailyNotes.userId, user.sub), eq(dailyNotes.noteDate, noteDate)),
      ).limit(1);

      if (existing.length > 0) {
        const [updated] = await db.update(dailyNotes)
          .set({ content, reflectionData, updatedAt: new Date() })
          .where(eq(dailyNotes.id, existing[0].id))
          .returning();
        return res.status(200).json(updated);
      }

      const [created] = await db.insert(dailyNotes).values({
        userId: user.sub,
        content,
        noteDate,
        reflectionData,
      }).returning();
      return res.status(201).json(created);
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}
