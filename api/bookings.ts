import type { VercelResponse } from '@vercel/node';
import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { bookings, timeBlocks, users } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';
import { freeSlots } from '../server/lib/availability.js';
import { emailBookingCreated, emailBookingDecision } from '../server/lib/email/notify.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THROTTLE_WINDOW_MS = 30_000;
const THROTTLE_MAX_IN_WINDOW = 1;

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const action = req.query.action ? String(req.query.action) : null;
  const id = req.query.id ? String(req.query.id) : null;

  try {
    if (req.method === 'GET' && action === 'free-slots') return getFreeSlots(req, res);
    if (req.method === 'POST' && !action) return createPublicBooking(req, res);
    if (req.method === 'GET' && action === 'mine') return listMine(req, res);
    if (req.method === 'POST' && action === 'approve' && id) return approve(req, res, id);
    if (req.method === 'POST' && action === 'reject' && id) return reject(req, res, id);
    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function getFreeSlots(req: AuthedRequest, res: VercelResponse) {
  const token = String(req.query.token || '');
  const date = req.query.date ? new Date(String(req.query.date)) : new Date();
  if (!token) return res.status(400).json({ error: 'token_required' });
  const [owner] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!owner || owner.privacy === 'private') return res.status(404).json({ error: 'not_found' });

  const from = new Date(date); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + 14);
  const slots = await freeSlots(owner.id, from, to, owner.timezone);
  return res.status(200).json({ owner: { name: owner.name, timezone: owner.timezone }, slots });
}

async function createPublicBooking(req: AuthedRequest, res: VercelResponse) {
  const { token, visitorName, visitorEmail, title, note, startAt, endAt } = req.body ?? {};
  if (!token || !visitorName || !EMAIL_RE.test(visitorEmail ?? '') || !title || !startAt || !endAt) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  const [owner] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!owner || owner.privacy === 'private') return res.status(404).json({ error: 'not_found' });

  const since = new Date(Date.now() - THROTTLE_WINDOW_MS);
  const recent = await db.select({ id: bookings.id }).from(bookings).where(and(
    eq(bookings.visitorEmail, visitorEmail),
    gte(bookings.createdAt, since),
  )).orderBy(desc(bookings.createdAt)).limit(THROTTLE_MAX_IN_WINDOW + 1);
  if (recent.length > THROTTLE_MAX_IN_WINDOW) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  try {
    const [block] = await db.insert(timeBlocks).values({
      userId: owner.id,
      title: `[pending] ${title}`,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      status: 'pending',
      note: `From ${visitorName} <${visitorEmail}>${note ? `\n${note}` : ''}`,
    }).returning();

    const [booking] = await db.insert(bookings).values({
      ownerUserId: owner.id,
      timeBlockId: block.id,
      visitorName, visitorEmail, title, note: note ?? null,
      startAt: new Date(startAt), endAt: new Date(endAt),
      status: 'pending',
    }).returning();

    // Fire-and-forget email; await briefly so serverless doesn't die before fetch completes
    await emailBookingCreated({
      ownerEmail: owner.email, ownerName: owner.name, ownerTz: owner.timezone,
      visitorName, visitorEmail, title, note,
      startAt: new Date(startAt), endAt: new Date(endAt),
      bookingId: booking.id,
    });

    return res.status(201).json({ id: booking.id, status: booking.status });
  } catch (e) {
    const msg = String((e as Error).message ?? '');
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'slot_taken' });
    }
    throw e;
  }
}

async function listMine(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res); if (!me) return;
  const rows = await db.select().from(bookings).where(eq(bookings.ownerUserId, me.sub));
  return res.status(200).json(rows);
}

async function approve(req: AuthedRequest, res: VercelResponse, id: string) {
  const me = requireAuth(req, res); if (!me) return;
  const [bk] = await db.update(bookings)
    .set({ status: 'approved' })
    .where(and(eq(bookings.id, id), eq(bookings.ownerUserId, me.sub)))
    .returning();
  if (!bk) return res.status(404).json({ error: 'not_found' });
  if (bk.timeBlockId) {
    await db.update(timeBlocks).set({
      status: 'planned', title: bk.title,
    }).where(eq(timeBlocks.id, bk.timeBlockId));
  }
  const [owner] = await db.select().from(users).where(eq(users.id, me.sub)).limit(1);
  if (owner) await emailBookingDecision({
    visitorEmail: bk.visitorEmail, visitorName: bk.visitorName,
    ownerName: owner.name, ownerTz: owner.timezone,
    title: bk.title, startAt: bk.startAt, endAt: bk.endAt,
    approved: true,
  });
  return res.status(200).json(bk);
}

async function reject(req: AuthedRequest, res: VercelResponse, id: string) {
  const me = requireAuth(req, res); if (!me) return;
  const [bk] = await db.update(bookings)
    .set({ status: 'rejected' })
    .where(and(eq(bookings.id, id), eq(bookings.ownerUserId, me.sub)))
    .returning();
  if (!bk) return res.status(404).json({ error: 'not_found' });
  if (bk.timeBlockId) {
    await db.delete(timeBlocks).where(eq(timeBlocks.id, bk.timeBlockId));
  }
  const [owner] = await db.select().from(users).where(eq(users.id, me.sub)).limit(1);
  if (owner) await emailBookingDecision({
    visitorEmail: bk.visitorEmail, visitorName: bk.visitorName,
    ownerName: owner.name, ownerTz: owner.timezone,
    title: bk.title, startAt: bk.startAt, endAt: bk.endAt,
    approved: false,
  });
  return res.status(200).json(bk);
}
