import type { VercelResponse } from '@vercel/node';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { timeBlocks, managerUsers, users } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';
import { materializeIfStale } from '../server/lib/recurring/materializer.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res);
  if (!me) return;
  const id = req.query.id ? String(req.query.id) : null;
  const viewUser = req.query.viewUser ? String(req.query.viewUser) : null;

  try {
    if (req.method === 'GET' && !id) {
      const targetUserId = viewUser ?? me.sub;
      if (viewUser && viewUser !== me.sub) {
        const { allowed, privacy } = await canViewUser(me.sub, me.role, viewUser);
        if (!allowed) return res.status(403).json({ error: 'forbidden' });
        await materializeIfStale(targetUserId);
        const rows = await fetchBlocks(targetUserId, req);
        return res.status(200).json(privacy === 'details_to_managers' ? rows : rows.map(redactBusy));
      }
      await materializeIfStale(me.sub);
      const rows = await fetchBlocks(me.sub, req);
      return res.status(200).json(rows);
    }

    if (req.method === 'POST' && !id) {
      const b = req.body ?? {};
      if (!b.title || !b.startAt || !b.endAt) return res.status(400).json({ error: 'invalid_input' });
      const [row] = await db.insert(timeBlocks).values({
        userId: me.sub,
        taskId: b.taskId ?? null,
        title: b.title,
        startAt: new Date(b.startAt),
        endAt: new Date(b.endAt),
        status: b.status ?? 'planned',
        note: b.note ?? null,
        recurringRule: b.recurringRule ?? null,
      }).returning();
      return res.status(201).json(row);
    }

    if (req.method === 'PATCH' && id) {
      const b = req.body ?? {};
      const patch: Record<string, unknown> = { ...b };
      if (b.startAt) patch.startAt = new Date(b.startAt);
      if (b.endAt) patch.endAt = new Date(b.endAt);
      // Auto-record actualMinutes when marking a block completed
      if (b.status === 'completed' && !b.actualMinutes) {
        const [existing] = await db.select().from(timeBlocks)
          .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, me.sub)))
          .limit(1);
        if (existing && !existing.actualMinutes) {
          patch.actualMinutes = Math.round(
            (existing.endAt.getTime() - existing.startAt.getTime()) / 60_000,
          );
        }
      }
      const [row] = await db.update(timeBlocks)
        .set(patch)
        .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, me.sub)))
        .returning();
      if (!row) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(row);
    }

    if (req.method === 'DELETE' && id) {
      await db.delete(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, me.sub)));
      return res.status(204).end();
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function fetchBlocks(userId: string, req: AuthedRequest) {
  const conds = [eq(timeBlocks.userId, userId)];
  if (req.query.from) conds.push(gte(timeBlocks.startAt, new Date(String(req.query.from))));
  if (req.query.to) conds.push(lte(timeBlocks.startAt, new Date(String(req.query.to))));
  return db.select().from(timeBlocks).where(and(...conds));
}

async function canViewUser(viewerId: string, viewerRole: string, targetId: string) {
  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) return { allowed: false, privacy: 'private' as const };

  if (viewerRole === 'admin') return { allowed: true, privacy: target.privacy };

  if (target.privacy === 'private') return { allowed: false, privacy: 'private' as const };

  const mapping = await db.select().from(managerUsers).where(and(
    eq(managerUsers.managerId, viewerId),
    eq(managerUsers.userId, targetId),
  )).limit(1);
  if (mapping[0]) return { allowed: true, privacy: target.privacy };

  return { allowed: false, privacy: 'private' as const };
}

function redactBusy(row: typeof timeBlocks.$inferSelect) {
  return { ...row, title: 'Busy', note: null, taskId: null };
}

// Keep import used (silences ts unused warning if inArray ends up unused).
void inArray;
