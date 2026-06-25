# Phase 02 — Calendly++ booking (brief)

Replaces: Calendly. Impact: High. Effort: Med. New function: No.

## Problem
Booking is hardcoded to 30-min slots over a 14-day horizon, single implicit availability. No event types, no weekday rules, no buffers, no visitor reschedule/cancel, no email confirmation.

## Scope (to detail next round)
- **Event types**: named offerings (e.g. 15m intro, 30m, 60m deep-dive) with duration + description per owner.
- **Availability rules**: per-weekday windows (e.g. Mon-Fri 09:00-17:00) in owner timezone, min-notice + buffer between bookings, max horizon configurable.
- **Visitor flow**: pick event type → see valid slots (existing busy + buffers removed) → confirm → email confirmation with reschedule/cancel links.
- **Owner**: manage event types + availability in settings; existing approve/reject inbox stays.

## Reuses
- `api/bookings.ts` (extend with `action`s), `/book/:token` page, provisional `time_blocks` flow, unique `(ownerUserId, startAt)` double-book guard, optional `RESEND_API_KEY` for email.

## Function-count impact
None. Extend `api/bookings.ts` via existing `action` dispatch.

## Schema (additive)
- `booking_event_types` (ownerUserId, name, durationMinutes, description, slug, active).
- `booking_availability` (ownerUserId, weekday, startMinute, endMinute) + owner-level buffer/min-notice/horizon (on `users` or a settings row).
- `bookings`: add `eventTypeId?`, `rescheduleToken`, `cancelToken`.
- Run `npm run db:push`.

## Risks
- Timezone correctness: compute slots in owner tz, render in visitor tz.
- Slot generation must exclude buffers + existing busy without an N+1 query.
- Reschedule/cancel tokens must be unguessable (nanoid) and single-purpose.
