import type { VercelResponse } from '@vercel/node';
import { and, desc, eq, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../server/lib/db/client.js';
import {
  bookings, bookingAvailability, bookingEventTypes,
  timeBlocks, users,
} from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';
import { freeSlots } from '../server/lib/availability.js';
import { freeSlotsV2 } from '../server/lib/booking/slots.js';
import {
  emailBookingCreated, emailBookingDecision,
  emailBookingVisitorLinks, emailBookingCancelled,
} from '../server/lib/email/notify.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const THROTTLE_WINDOW_MS = 30_000;
const THROTTLE_MAX_IN_WINDOW = 1;

// Slug: lowercase alphanumeric + hyphens, max 60 chars.
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const action = req.query.action ? String(req.query.action) : null;
  const id = req.query.id ? String(req.query.id) : null;

  try {
    // Public (unauthenticated) endpoints.
    if (req.method === 'GET' && action === 'free-slots') return getFreeSlots(req, res);
    if (req.method === 'GET' && action === 'slots') return getSlotsV2(req, res);
    if (req.method === 'GET' && action === 'event-types-public') return getEventTypesPublic(req, res);
    if (req.method === 'POST' && !action) return createPublicBooking(req, res);
    if (req.method === 'POST' && action === 'reschedule-by-token') return rescheduleByToken(req, res);
    if (req.method === 'POST' && action === 'cancel-by-token') return cancelByToken(req, res);
    if (req.method === 'GET' && action === 'booking-by-token') return getBookingByToken(req, res);
    if (req.method === 'GET' && action === 'reschedule-slots') return getRescheduleSlots(req, res);

    // Authenticated owner endpoints.
    if (req.method === 'GET' && action === 'mine') return listMine(req, res);
    if (req.method === 'POST' && action === 'approve' && id) return approve(req, res, id);
    if (req.method === 'POST' && action === 'reject' && id) return reject(req, res, id);

    // Event types CRUD.
    if (req.method === 'GET' && action === 'event-types') return listEventTypes(req, res);
    if (req.method === 'POST' && action === 'event-types') return createEventType(req, res);
    if (req.method === 'PATCH' && action === 'event-types' && id) return updateEventType(req, res, id);
    if (req.method === 'DELETE' && action === 'event-types' && id) return deleteEventType(req, res, id);

    // Availability CRUD.
    if (req.method === 'GET' && action === 'availability') return listAvailability(req, res);
    if (req.method === 'PUT' && action === 'availability') return replaceAvailability(req, res);

    // Booking settings (buffer / min-notice / horizon).
    if (req.method === 'PATCH' && action === 'booking-settings') return updateBookingSettings(req, res);

    return res.status(404).json({ error: 'not_found' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ---------------------------------------------------------------------------
// Public: legacy free slots (30-min hard-coded, keeps backward compat)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Public: event-type-aware slot generation
// ---------------------------------------------------------------------------
async function getSlotsV2(req: AuthedRequest, res: VercelResponse) {
  const token = String(req.query.token || '');
  const eventTypeId = req.query.eventTypeId ? String(req.query.eventTypeId) : null;
  if (!token) return res.status(400).json({ error: 'token_required' });
  if (!eventTypeId) return res.status(400).json({ error: 'event_type_required' });

  const [owner] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!owner || owner.privacy === 'private') return res.status(404).json({ error: 'not_found' });

  const [et] = await db.select().from(bookingEventTypes)
    .where(and(
      eq(bookingEventTypes.id, eventTypeId),
      eq(bookingEventTypes.ownerUserId, owner.id),
      eq(bookingEventTypes.active, true),
    )).limit(1);
  if (!et) return res.status(404).json({ error: 'event_type_not_found' });

  const slots = await freeSlotsV2({
    userId: owner.id,
    durationMinutes: et.durationMinutes,
    bufferMinutes: owner.bookingBufferMinutes,
    minNoticeMinutes: owner.bookingMinNoticeMinutes,
    horizonDays: owner.bookingHorizonDays,
    tz: owner.timezone,
  });

  return res.status(200).json({
    owner: { name: owner.name, timezone: owner.timezone },
    eventType: { id: et.id, name: et.name, durationMinutes: et.durationMinutes, description: et.description },
    slots,
  });
}

// ---------------------------------------------------------------------------
// Public: list active event types for a share token
// ---------------------------------------------------------------------------
async function getEventTypesPublic(req: AuthedRequest, res: VercelResponse) {
  const token = String(req.query.token || '');
  if (!token) return res.status(400).json({ error: 'token_required' });
  const [owner] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!owner || owner.privacy === 'private') return res.status(404).json({ error: 'not_found' });

  const ets = await db.select().from(bookingEventTypes)
    .where(and(
      eq(bookingEventTypes.ownerUserId, owner.id),
      eq(bookingEventTypes.active, true),
    ));

  return res.status(200).json({
    owner: { name: owner.name, timezone: owner.timezone },
    eventTypes: ets,
  });
}

// ---------------------------------------------------------------------------
// Public: create booking (extended to store reschedule/cancel tokens + eventTypeId)
// ---------------------------------------------------------------------------
async function createPublicBooking(req: AuthedRequest, res: VercelResponse) {
  const { token, visitorName, visitorEmail, title, note, startAt, endAt, eventTypeId } = req.body ?? {};
  if (!token || !visitorName || !EMAIL_RE.test(visitorEmail ?? '') || !title || !startAt || !endAt) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  const [owner] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!owner || owner.privacy === 'private') return res.status(404).json({ error: 'not_found' });

  // Throttle per visitor email.
  const since = new Date(Date.now() - THROTTLE_WINDOW_MS);
  const recent = await db.select({ id: bookings.id }).from(bookings).where(and(
    eq(bookings.visitorEmail, visitorEmail),
    gte(bookings.createdAt, since),
  )).orderBy(desc(bookings.createdAt)).limit(THROTTLE_MAX_IN_WINDOW + 1);
  if (recent.length > THROTTLE_MAX_IN_WINDOW) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  // If eventTypeId provided, validate it belongs to this owner.
  let resolvedEventTypeId: string | null = null;
  if (eventTypeId) {
    const [et] = await db.select({ id: bookingEventTypes.id }).from(bookingEventTypes)
      .where(and(eq(bookingEventTypes.id, eventTypeId), eq(bookingEventTypes.ownerUserId, owner.id)))
      .limit(1);
    if (et) resolvedEventTypeId = et.id;
  }

  const rescheduleToken = nanoid(32);
  const cancelToken = nanoid(32);

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
      eventTypeId: resolvedEventTypeId,
      visitorName, visitorEmail, title, note: note ?? null,
      startAt: new Date(startAt), endAt: new Date(endAt),
      status: 'pending',
      rescheduleToken,
      cancelToken,
    }).returning();

    // Fire-and-forget emails.
    await Promise.all([
      emailBookingCreated({
        ownerEmail: owner.email, ownerName: owner.name, ownerTz: owner.timezone,
        visitorName, visitorEmail, title, note,
        startAt: new Date(startAt), endAt: new Date(endAt),
        bookingId: booking.id,
      }),
      emailBookingVisitorLinks({
        visitorEmail, visitorName,
        ownerName: owner.name, ownerTz: owner.timezone,
        title, startAt: new Date(startAt), endAt: new Date(endAt),
        rescheduleToken, cancelToken,
      }),
    ]);

    return res.status(201).json({
      id: booking.id,
      status: booking.status,
      rescheduleToken,
      cancelToken,
    });
  } catch (e) {
    const msg = String((e as Error).message ?? '');
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'slot_taken' });
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Public: look up a booking by reschedule or cancel token
// ---------------------------------------------------------------------------
async function getBookingByToken(req: AuthedRequest, res: VercelResponse) {
  const rescheduleToken = req.query.rescheduleToken ? String(req.query.rescheduleToken) : null;
  const cancelToken = req.query.cancelToken ? String(req.query.cancelToken) : null;
  if (!rescheduleToken && !cancelToken) return res.status(400).json({ error: 'token_required' });

  let bk;
  if (rescheduleToken) {
    [bk] = await db.select().from(bookings).where(eq(bookings.rescheduleToken, rescheduleToken)).limit(1);
  } else {
    [bk] = await db.select().from(bookings).where(eq(bookings.cancelToken, cancelToken!)).limit(1);
  }
  if (!bk) return res.status(404).json({ error: 'not_found' });
  if (bk.status === 'cancelled' || bk.status === 'rejected') {
    return res.status(410).json({ error: 'booking_inactive' });
  }

  // Return safe subset (no internal IDs).
  return res.status(200).json({
    id: bk.id,
    title: bk.title,
    startAt: bk.startAt,
    endAt: bk.endAt,
    status: bk.status,
    visitorName: bk.visitorName,
    ownerUserId: bk.ownerUserId,
    eventTypeId: bk.eventTypeId,
  });
}

// ---------------------------------------------------------------------------
// Public: return available slots keyed by rescheduleToken
// The booking's own current slot is excluded from busy so the visitor can
// re-select it when only minor changes are needed.
// ---------------------------------------------------------------------------
async function getRescheduleSlots(req: AuthedRequest, res: VercelResponse) {
  const rescheduleToken = req.query.rescheduleToken ? String(req.query.rescheduleToken) : null;
  if (!rescheduleToken) return res.status(400).json({ error: 'token_required' });

  const [bk] = await db.select().from(bookings)
    .where(eq(bookings.rescheduleToken, rescheduleToken)).limit(1);
  if (!bk) return res.status(404).json({ error: 'not_found' });
  if (bk.status === 'cancelled' || bk.status === 'rejected') {
    return res.status(410).json({ error: 'booking_inactive' });
  }

  const [owner] = await db.select().from(users).where(eq(users.id, bk.ownerUserId)).limit(1);
  if (!owner || owner.privacy === 'private') return res.status(404).json({ error: 'not_found' });

  // Determine event type duration. Fall back to the booking's own duration if no event type.
  let durationMinutes = 30;
  if (bk.eventTypeId) {
    const [et] = await db.select({ durationMinutes: bookingEventTypes.durationMinutes })
      .from(bookingEventTypes)
      .where(and(
        eq(bookingEventTypes.id, bk.eventTypeId),
        eq(bookingEventTypes.ownerUserId, owner.id),
      )).limit(1);
    if (et) durationMinutes = et.durationMinutes;
  } else {
    // Derive from booking times when no event type is set.
    const diffMs = new Date(bk.endAt).getTime() - new Date(bk.startAt).getTime();
    const derived = Math.round(diffMs / 60_000);
    if (derived >= 5 && derived <= 480) durationMinutes = derived;
  }

  const slots = await freeSlotsV2({
    userId: owner.id,
    durationMinutes,
    bufferMinutes: owner.bookingBufferMinutes,
    minNoticeMinutes: owner.bookingMinNoticeMinutes,
    horizonDays: owner.bookingHorizonDays,
    tz: owner.timezone,
    // Pass the booking's current slot as an exclusion hint via the options so
    // freeSlotsV2 can treat it as free (we reconstruct it below after generation).
  });

  // Re-insert the booking's current slot if it falls within the horizon and
  // is not already present (so the visitor can keep the same time).
  const currentStart = new Date(bk.startAt);
  const currentEnd = new Date(bk.endAt);
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + owner.bookingHorizonDays * 24 * 60 * 60_000);
  const alreadyPresent = slots.some(s => s.startAt === currentStart.toISOString());
  if (!alreadyPresent && currentStart > now && currentStart < horizonEnd) {
    // Insert in chronological order.
    const insertIdx = slots.findIndex(s => new Date(s.startAt) > currentStart);
    const entry = { startAt: currentStart.toISOString(), endAt: currentEnd.toISOString() };
    if (insertIdx === -1) {
      slots.push(entry);
    } else {
      slots.splice(insertIdx, 0, entry);
    }
  }

  return res.status(200).json({
    owner: { name: owner.name, timezone: owner.timezone },
    slots,
  });
}

// ---------------------------------------------------------------------------
// Public: visitor cancels via cancelToken
// ---------------------------------------------------------------------------
async function cancelByToken(req: AuthedRequest, res: VercelResponse) {
  const { cancelToken } = req.body ?? {};
  if (!cancelToken) return res.status(400).json({ error: 'token_required' });

  const [bk] = await db.select().from(bookings).where(eq(bookings.cancelToken, cancelToken)).limit(1);
  if (!bk) return res.status(404).json({ error: 'not_found' });
  if (bk.status === 'cancelled' || bk.status === 'rejected') {
    return res.status(410).json({ error: 'booking_inactive' });
  }

  await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, bk.id));

  // Remove the provisional time block.
  if (bk.timeBlockId) {
    await db.delete(timeBlocks).where(eq(timeBlocks.id, bk.timeBlockId));
  }

  const [owner] = await db.select().from(users).where(eq(users.id, bk.ownerUserId)).limit(1);
  if (owner) {
    await emailBookingCancelled({
      visitorEmail: bk.visitorEmail, visitorName: bk.visitorName,
      ownerName: owner.name, ownerTz: owner.timezone,
      title: bk.title, startAt: bk.startAt, endAt: bk.endAt,
    });
  }

  return res.status(200).json({ status: 'cancelled' });
}

// ---------------------------------------------------------------------------
// Public: visitor reschedules via rescheduleToken
// ---------------------------------------------------------------------------
async function rescheduleByToken(req: AuthedRequest, res: VercelResponse) {
  const { rescheduleToken, startAt, endAt } = req.body ?? {};
  if (!rescheduleToken || !startAt || !endAt) return res.status(400).json({ error: 'invalid_input' });

  const [bk] = await db.select().from(bookings).where(eq(bookings.rescheduleToken, rescheduleToken)).limit(1);
  if (!bk) return res.status(404).json({ error: 'not_found' });
  if (bk.status === 'cancelled' || bk.status === 'rejected') {
    return res.status(410).json({ error: 'booking_inactive' });
  }

  const newStart = new Date(startAt);
  const newEnd = new Date(endAt);

  // Issue fresh tokens so old links become invalid after reschedule.
  const newRescheduleToken = nanoid(32);
  const newCancelToken = nanoid(32);

  try {
    await db.update(bookings).set({
      startAt: newStart,
      endAt: newEnd,
      status: 'pending',
      rescheduleToken: newRescheduleToken,
      cancelToken: newCancelToken,
    }).where(eq(bookings.id, bk.id));

    if (bk.timeBlockId) {
      await db.update(timeBlocks).set({
        startAt: newStart,
        endAt: newEnd,
        status: 'pending',
      }).where(eq(timeBlocks.id, bk.timeBlockId));
    }

    const [owner] = await db.select().from(users).where(eq(users.id, bk.ownerUserId)).limit(1);
    if (owner) {
      await Promise.all([
        emailBookingCreated({
          ownerEmail: owner.email, ownerName: owner.name, ownerTz: owner.timezone,
          visitorName: bk.visitorName, visitorEmail: bk.visitorEmail,
          title: `[Rescheduled] ${bk.title}`, note: null,
          startAt: newStart, endAt: newEnd, bookingId: bk.id,
        }),
        emailBookingVisitorLinks({
          visitorEmail: bk.visitorEmail, visitorName: bk.visitorName,
          ownerName: owner.name, ownerTz: owner.timezone,
          title: bk.title, startAt: newStart, endAt: newEnd,
          rescheduleToken: newRescheduleToken, cancelToken: newCancelToken,
        }),
      ]);
    }

    return res.status(200).json({
      status: 'pending',
      rescheduleToken: newRescheduleToken,
      cancelToken: newCancelToken,
    });
  } catch (e) {
    const msg = String((e as Error).message ?? '');
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'slot_taken' });
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Owner: list own bookings
// ---------------------------------------------------------------------------
async function listMine(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res); if (!me) return;
  const rows = await db.select().from(bookings).where(eq(bookings.ownerUserId, me.sub));
  return res.status(200).json(rows);
}

// ---------------------------------------------------------------------------
// Owner: approve a booking
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Owner: reject a booking
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Owner: list own event types
// ---------------------------------------------------------------------------
async function listEventTypes(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res); if (!me) return;
  const rows = await db.select().from(bookingEventTypes)
    .where(eq(bookingEventTypes.ownerUserId, me.sub));
  return res.status(200).json(rows);
}

// ---------------------------------------------------------------------------
// Owner: create event type
// ---------------------------------------------------------------------------
async function createEventType(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res); if (!me) return;
  const { name, durationMinutes, description, active } = req.body ?? {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name_required' });
  }
  const dur = Number(durationMinutes);
  if (!Number.isInteger(dur) || dur < 5 || dur > 480) {
    return res.status(400).json({ error: 'invalid_duration' });
  }

  const slug = toSlug(name.trim());
  if (!slug) return res.status(400).json({ error: 'invalid_name' });

  try {
    const [row] = await db.insert(bookingEventTypes).values({
      ownerUserId: me.sub,
      name: name.trim(),
      slug,
      description: description ? String(description).trim() : null,
      durationMinutes: dur,
      active: active !== false,
    }).returning();
    return res.status(201).json(row);
  } catch (e) {
    const msg = String((e as Error).message ?? '');
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'slug_conflict' });
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Owner: update event type
// ---------------------------------------------------------------------------
async function updateEventType(req: AuthedRequest, res: VercelResponse, id: string) {
  const me = requireAuth(req, res); if (!me) return;
  const { name, durationMinutes, description, active } = req.body ?? {};

  const patch: Partial<{
    name: string; slug: string; description: string | null;
    durationMinutes: number; active: boolean;
  }> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name_required' });
    }
    patch.name = name.trim();
    patch.slug = toSlug(name.trim());
  }
  if (durationMinutes !== undefined) {
    const dur = Number(durationMinutes);
    if (!Number.isInteger(dur) || dur < 5 || dur > 480) {
      return res.status(400).json({ error: 'invalid_duration' });
    }
    patch.durationMinutes = dur;
  }
  if (description !== undefined) patch.description = description ? String(description).trim() : null;
  if (active !== undefined) patch.active = Boolean(active);

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });

  try {
    const [row] = await db.update(bookingEventTypes).set(patch)
      .where(and(eq(bookingEventTypes.id, id), eq(bookingEventTypes.ownerUserId, me.sub)))
      .returning();
    if (!row) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json(row);
  } catch (e) {
    const msg = String((e as Error).message ?? '');
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return res.status(409).json({ error: 'slug_conflict' });
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Owner: delete event type
// ---------------------------------------------------------------------------
async function deleteEventType(req: AuthedRequest, res: VercelResponse, id: string) {
  const me = requireAuth(req, res); if (!me) return;
  const [row] = await db.delete(bookingEventTypes)
    .where(and(eq(bookingEventTypes.id, id), eq(bookingEventTypes.ownerUserId, me.sub)))
    .returning({ id: bookingEventTypes.id });
  if (!row) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json({ deleted: true });
}

// ---------------------------------------------------------------------------
// Owner: list availability windows
// ---------------------------------------------------------------------------
async function listAvailability(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res); if (!me) return;
  const rows = await db.select().from(bookingAvailability)
    .where(eq(bookingAvailability.ownerUserId, me.sub));
  return res.status(200).json(rows);
}

// ---------------------------------------------------------------------------
// Owner: replace all availability windows (PUT semantics — full replacement)
// ---------------------------------------------------------------------------
async function replaceAvailability(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res); if (!me) return;
  const { windows } = req.body ?? {};
  if (!Array.isArray(windows)) return res.status(400).json({ error: 'invalid_input' });

  for (const w of windows) {
    const { weekday, startMinute, endMinute } = w ?? {};
    if (
      !Number.isInteger(weekday) || weekday < 0 || weekday > 6 ||
      !Number.isInteger(startMinute) || startMinute < 0 || startMinute >= 1440 ||
      !Number.isInteger(endMinute) || endMinute <= startMinute || endMinute > 1440
    ) {
      return res.status(400).json({ error: 'invalid_window' });
    }
  }

  // Delete existing, insert new in one transaction-ish sequence.
  await db.delete(bookingAvailability).where(eq(bookingAvailability.ownerUserId, me.sub));

  let rows: typeof bookingAvailability.$inferSelect[] = [];
  if (windows.length > 0) {
    rows = await db.insert(bookingAvailability).values(
      windows.map((w: { weekday: number; startMinute: number; endMinute: number }) => ({
        ownerUserId: me.sub,
        weekday: w.weekday,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
      }))
    ).returning();
  }

  return res.status(200).json(rows);
}

// ---------------------------------------------------------------------------
// Owner: update booking settings (buffer / min-notice / horizon)
// ---------------------------------------------------------------------------
async function updateBookingSettings(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res); if (!me) return;
  const { bookingBufferMinutes, bookingMinNoticeMinutes, bookingHorizonDays } = req.body ?? {};

  const patch: Partial<{
    bookingBufferMinutes: number;
    bookingMinNoticeMinutes: number;
    bookingHorizonDays: number;
  }> = {};

  if (bookingBufferMinutes !== undefined) {
    const v = Number(bookingBufferMinutes);
    if (!Number.isInteger(v) || v < 0 || v > 240) return res.status(400).json({ error: 'invalid_buffer' });
    patch.bookingBufferMinutes = v;
  }
  if (bookingMinNoticeMinutes !== undefined) {
    const v = Number(bookingMinNoticeMinutes);
    if (!Number.isInteger(v) || v < 0 || v > 10080) return res.status(400).json({ error: 'invalid_min_notice' });
    patch.bookingMinNoticeMinutes = v;
  }
  if (bookingHorizonDays !== undefined) {
    const v = Number(bookingHorizonDays);
    if (!Number.isInteger(v) || v < 1 || v > 365) return res.status(400).json({ error: 'invalid_horizon' });
    patch.bookingHorizonDays = v;
  }

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing_to_update' });

  const [updated] = await db.update(users).set(patch).where(eq(users.id, me.sub)).returning({
    bookingBufferMinutes: users.bookingBufferMinutes,
    bookingMinNoticeMinutes: users.bookingMinNoticeMinutes,
    bookingHorizonDays: users.bookingHorizonDays,
  });

  return res.status(200).json(updated);
}

