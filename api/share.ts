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
    if (req.method === 'GET' && token && action === 'ics') return icsFeed(token, res, req.query);
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

async function icsFeed(token: string, res: VercelResponse, query: Record<string, any>) {
  const [owner] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!owner || owner.privacy === 'private') return res.status(404).json({ error: 'not_found' });

  await materializeIfStale(owner.id);

  // Default range: today to today + 60 days
  const now = new Date();
  const start = query.start ? new Date(query.start) : new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = query.end ? new Date(query.end) : new Date(start);
  end.setUTCDate(end.getUTCDate() + 60);

  const rows = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, owner.id),
    gte(timeBlocks.startAt, start),
    lte(timeBlocks.startAt, end),
  ));

  const blocks = owner.privacy === 'details_to_managers'
    ? rows
    : rows.map(r => ({ ...r, title: 'Busy', note: null, taskId: null }));

  const ics = generateIcs(blocks, owner.name || 'Daily Planner');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Disposition', `attachment; filename="daily-planner-${owner.name || 'feed'}.ics"`);
  return res.status(200).send(ics);
}

function generateIcs(blocks: any[], calendarName: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daily Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
    'X-WR-CALDESC:Daily Planner Time Blocks',
  ];

  blocks.forEach(block => {
    const startDate = new Date(block.startAt);
    const endDate = new Date(block.endAt);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${block.id}@daily-planner`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    lines.push(`DTSTART:${formatIcsDate(startDate)}`);
    lines.push(`DTEND:${formatIcsDate(endDate)}`);
    lines.push(`SUMMARY:${escapeIcs(block.title)}`);

    if (block.note) {
      lines.push(`DESCRIPTION:${escapeIcs(block.note)}`);
    }

    lines.push(`STATUS:${mapStatus(block.status)}`);
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function mapStatus(status: string): string {
  switch (status) {
    case 'completed': return 'COMPLETED';
    case 'in_progress': return 'IN_PROCESS';
    case 'skipped': return 'CANCELLED';
    default: return 'TENTATIVE';
  }
}
