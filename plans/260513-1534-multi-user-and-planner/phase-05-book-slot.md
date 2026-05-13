# Phase 05 — Book-slot (Calendly-style)

**Status:** Pending · **Priority:** P1 · **Depends on:** Phase 01, 04

## Overview

External (unauthenticated) visitor lands on `/book/:token` (same share token as Phase 04, or a separate `booking_token` — see decision below). Sees a list of 30-min free slots within next 14 days. Submits name + email + title → creates `bookings` row + provisional `time_block` (`status = 'pending'`). Owner sees pending list, approves or rejects.

## Decision: token reuse

**Reuse `shareToken`.** Reasons:
- One link the user shares for both "see my week" and "book a slot with me".
- Disabling share simultaneously disables booking.
- If we ever need separate, add `bookingToken` later — no migration pain.

## Endpoint

`api/bookings.ts` (new function, +1 to budget → total 7):

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/bookings/free-slots?token=&date=` | none | returns array of 30-min `{startAt, endAt}` free in next 14d from given date |
| POST | `/api/bookings` | none | body `{token, visitorName, visitorEmail, title, startAt, endAt}` → creates pending booking + time_block, returns `{id, status}` |
| GET | `/api/bookings?action=mine` | requireAuth | owner sees own pending+approved bookings |
| POST | `/api/bookings?action=approve&id=` | requireAuth | sets booking → `approved`, time_block → `planned` |
| POST | `/api/bookings?action=reject&id=` | requireAuth | sets booking → `rejected`, deletes time_block |

Rewrites:
```json
{ "source": "/api/bookings/:action", "destination": "/api/bookings?action=:action" }
```

## Free slot algorithm

```
freeSlots(userId, date):
  windowStart = date 06:00 in userTZ
  windowEnd   = date + 14d 22:00 in userTZ
  busy = SELECT time_blocks WHERE userId AND startAt < windowEnd AND endAt > windowStart
       UNION pending bookings (count as busy to avoid double-book)
  free = subtract(busy from [windowStart..windowEnd workday hours])
  return free.split(30min)
```

Respect user's `privacy` setting only for surfacing busy blocks' titles — slot list itself is always shown.

## Frontend

- `src/pages/book-slot-page.tsx`:
  - Calendar date-picker (next 14 days)
  - List of free slots for picked date
  - Form: name, email, meeting title
  - Submit → success screen "Pending approval from {ownerName}"

- Dashboard adds "Pending bookings" panel for owners with approve/reject buttons.

## Todo

- [ ] `api/bookings.ts`
- [ ] Free-slot algorithm in `server/lib/availability.ts` (<150 lines)
- [ ] Rewrite rules in `vercel.json`
- [ ] `book-slot-page.tsx`
- [ ] Pending-bookings panel
- [ ] Router: `/book/:token`

## Success criteria

- External user can book a 30-min slot at 2026-05-20 14:00
- Owner sees "1 pending booking" in dashboard
- Approve → block status becomes `planned`, visible on planner
- Reject → block deleted, booking marked `rejected`

## Risks

- Spam: add rate-limit by IP (5/hour) and email regex validation. Phase 2 can add captcha.
- Race: two visitors book same slot simultaneously → unique constraint on `(ownerUserId, startAt)` in `bookings` prevents duplicates. Second one gets 409.
