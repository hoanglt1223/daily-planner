import type { VercelResponse } from '@vercel/node';
import { desc, eq } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { activityLog } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    // GET /api/activity-logs
    if (req.method === 'GET') {
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const logs = await db
        .select()
        .from(activityLog)
        .where(eq(activityLog.userId, user.sub))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit)
        .offset(offset);

      return res.status(200).json(logs);
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}
