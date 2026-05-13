import type { VercelResponse } from '@vercel/node';
import { and, eq, gte, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../server/lib/db/client.js';
import { users, timeBlocks } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';
import { materializeIfStale } from '../server/lib/recurring/materializer.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const token = req.query.token ? String(req.query.token) : null;
  const action = req.query.action ? String(req.query.action) : null;

  try {
    if (req.method === 'GET' && token) return publicView(token, res);

    const me = requireAuth(req, res);
    if (!me) return;

    if (req.method === 'POST' && action === 'enable') {
      const tok = nanoid(16);
      await db.update(users).set({ shareToken: tok }).where(eq(users.id, me.sub));
      return res.status(200).json({ shareToken: tok });
    }
    if (req.method === 'POST' && action === 'disable') {
      await db.update(users).set({ shareToken: null }).where(eq(users.id, me.sub));
      return res.status(204).end();
    }
    if (req.method === 'POST' && action === 'privacy') {
      const { privacy } = req.body ?? {};
      if (!['details_to_managers', 'busy_only_to_managers', 'private'].includes(privacy)) {
        return res.status(400).json({ error: 'invalid_privacy' });
      }
      await db.update(users).set({ privacy }).where(eq(users.id, me.sub));
      return res.status(200).json({ privacy });
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function publicView(token: string, res: VercelResponse) {
  const [owner] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!owner || owner.privacy === 'private') return res.status(404).json({ error: 'not_found' });

  await materializeIfStale(owner.id);

  const now = new Date(); const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 21);

  const rows = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, owner.id),
    gte(timeBlocks.startAt, start),
    lte(timeBlocks.startAt, end),
  ));

  const blocks = owner.privacy === 'details_to_managers'
    ? rows
    : rows.map(r => ({ ...r, title: 'Busy', note: null, taskId: null }));

  res.setHeader('Cache-Control', 'private, max-age=60');
  return res.status(200).json({
    user: { name: owner.name, timezone: owner.timezone },
    privacy: owner.privacy,
    blocks,
  });
}
