import type { VercelResponse } from '@vercel/node';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { users, managerUsers } from '../server/lib/db/schema.js';
import { requireAdmin, requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const action = String(req.query.action || '');

  try {
    // Manager + admin can list users they manage
    if (action === 'managed-users' && req.method === 'GET') return managedUsers(req, res);

    // Admin-only actions below
    const admin = requireAdmin(req, res); if (!admin) return;

    if (action === 'users' && req.method === 'GET') {
      const rows = await db.select({
        id: users.id, email: users.email, name: users.name,
        role: users.role, privacy: users.privacy, createdAt: users.createdAt,
      }).from(users);
      return res.status(200).json(rows);
    }
    if (action === 'set-role' && req.method === 'POST') {
      const { userId, role } = req.body ?? {};
      if (!userId || !['user', 'manager', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'invalid_input' });
      }
      const [row] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();
      if (!row) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json({ id: row.id, role: row.role });
    }
    if (action === 'assign-manager' && req.method === 'POST') {
      const { managerId, userId } = req.body ?? {};
      if (!managerId || !userId) return res.status(400).json({ error: 'invalid_input' });
      await db.insert(managerUsers).values({ managerId, userId }).onConflictDoNothing();
      return res.status(204).end();
    }
    if (action === 'unassign-manager' && req.method === 'POST') {
      const { managerId, userId } = req.body ?? {};
      if (!managerId || !userId) return res.status(400).json({ error: 'invalid_input' });
      await db.delete(managerUsers).where(and(
        eq(managerUsers.managerId, managerId), eq(managerUsers.userId, userId),
      ));
      return res.status(204).end();
    }
    if (action === 'list-mappings' && req.method === 'GET') {
      const rows = await db.select().from(managerUsers);
      return res.status(200).json(rows);
    }

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function managedUsers(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res); if (!me) return;
  if (me.role === 'admin') {
    const rows = await db.select({
      id: users.id, name: users.name, email: users.email, privacy: users.privacy,
    }).from(users);
    return res.status(200).json(rows);
  }
  if (me.role === 'manager') {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, privacy: users.privacy })
      .from(managerUsers)
      .innerJoin(users, eq(users.id, managerUsers.userId))
      .where(eq(managerUsers.managerId, me.sub));
    return res.status(200).json(rows);
  }
  return res.status(403).json({ error: 'forbidden' });
}
