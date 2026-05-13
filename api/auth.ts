import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { users } from '../server/lib/db/schema.js';
import { hashPassword, verifyPassword, signToken } from '../server/lib/auth.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const action = String(req.query.action || '');
  try {
    if (action === 'register' && req.method === 'POST') return register(req, res);
    if (action === 'login' && req.method === 'POST') return login(req, res);
    if (action === 'me' && req.method === 'GET') return me(req, res);
    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

function isAdminEmail(email: string): boolean {
  const v = process.env.ADMIN_EMAIL;
  if (!v) return false;
  return v.split(',').map(s => s.trim().toLowerCase()).includes(email.toLowerCase());
}

async function register(req: VercelRequest, res: VercelResponse) {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || password.length < 8 || !name) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return res.status(409).json({ error: 'email_taken' });

  const role = isAdminEmail(email) ? 'admin' : 'user';
  const [u] = await db.insert(users).values({
    email, name, passwordHash: hashPassword(password), role,
  }).returning();
  const token = signToken({ sub: u.id, email: u.email, role: u.role });
  return res.status(200).json({ token, user: publicUser(u) });
}

async function login(req: VercelRequest, res: VercelResponse) {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'invalid_input' });
  let [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u || !verifyPassword(password, u.passwordHash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  // Auto-promote on login if email is in ADMIN_EMAIL allowlist and not already admin.
  // Covers the case where the user registered before ADMIN_EMAIL was set.
  if (u.role !== 'admin' && isAdminEmail(u.email)) {
    [u] = await db.update(users).set({ role: 'admin' }).where(eq(users.id, u.id)).returning();
  }
  const token = signToken({ sub: u.id, email: u.email, role: u.role });
  return res.status(200).json({ token, user: publicUser(u) });
}

async function me(req: AuthedRequest, res: VercelResponse) {
  const u = requireAuth(req, res);
  if (!u) return;
  const [row] = await db.select().from(users).where(eq(users.id, u.sub)).limit(1);
  if (!row) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json(publicUser(row));
}

function publicUser(u: typeof users.$inferSelect) {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role,
    privacy: u.privacy, timezone: u.timezone,
    shareToken: u.shareToken,
  };
}
