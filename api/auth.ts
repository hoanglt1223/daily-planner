import type { VercelRequest, VercelResponse } from '@vercel/node';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
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
    if (action === 'update' && req.method === 'PATCH') return updateProfile(req, res);
    if (action === 'change-password' && req.method === 'POST') return changePassword(req, res);
    if (action === 'regenerate-token' && req.method === 'POST') return regenerateShareToken(req, res);
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
    hourlyRate: u.hourlyRate,
    bookingBufferMinutes: u.bookingBufferMinutes,
    bookingMinNoticeMinutes: u.bookingMinNoticeMinutes,
    bookingHorizonDays: u.bookingHorizonDays,
    focusWorkMinutes: u.focusWorkMinutes,
    focusBreakMinutes: u.focusBreakMinutes,
  };
}

async function updateProfile(req: AuthedRequest, res: VercelResponse) {
  const authed = requireAuth(req, res);
  if (!authed) return;

  const { name, timezone, privacy, hourlyRate, focusWorkMinutes, focusBreakMinutes } = req.body ?? {};
  const patch: Record<string, unknown> = {};

  if (typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 100) {
    patch.name = name.trim();
  }
  if (typeof timezone === 'string' && timezone.length <= 60) {
    patch.timezone = timezone;
  }
  const validPrivacy = ['details_to_managers', 'busy_only_to_managers', 'private'];
  if (typeof privacy === 'string' && validPrivacy.includes(privacy)) {
    patch.privacy = privacy;
  }
  // Handle hourlyRate: null, undefined, or a non-negative integer
  if (hourlyRate === null || hourlyRate === undefined) {
    // Explicitly set to null to clear the value
    patch.hourlyRate = null;
  } else if (typeof hourlyRate === 'number') {
    if (hourlyRate >= 0) {
      patch.hourlyRate = hourlyRate;
    } else {
      return res.status(400).json({ error: 'invalid_hourly_rate' });
    }
  }

  // Handle focus timer settings
  if (typeof focusWorkMinutes === 'number') {
    if (focusWorkMinutes >= 1 && focusWorkMinutes <= 180) {
      patch.focusWorkMinutes = focusWorkMinutes;
    } else {
      return res.status(400).json({ error: 'invalid_focus_work_minutes' });
    }
  }

  if (typeof focusBreakMinutes === 'number') {
    if (focusBreakMinutes >= 1 && focusBreakMinutes <= 60) {
      patch.focusBreakMinutes = focusBreakMinutes;
    } else {
      return res.status(400).json({ error: 'invalid_focus_break_minutes' });
    }
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'nothing_to_update' });
  }

  const [updated] = await db.update(users).set(patch).where(eq(users.id, authed.sub)).returning();
  if (!updated) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json(publicUser(updated));
}

async function changePassword(req: AuthedRequest, res: VercelResponse) {
  const authed = requireAuth(req, res);
  if (!authed) return;

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  const [u] = await db.select().from(users).where(eq(users.id, authed.sub)).limit(1);
  if (!u) return res.status(404).json({ error: 'not_found' });

  if (!verifyPassword(currentPassword, u.passwordHash)) {
    return res.status(401).json({ error: 'wrong_password' });
  }

  await db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, authed.sub));
  return res.status(200).json({ ok: true });
}

async function regenerateShareToken(req: AuthedRequest, res: VercelResponse) {
  const authed = requireAuth(req, res);
  if (!authed) return;

  const newToken = nanoid(16);
  const [updated] = await db.update(users).set({ shareToken: newToken }).where(eq(users.id, authed.sub)).returning();
  if (!updated) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json({ shareToken: newToken });
}
