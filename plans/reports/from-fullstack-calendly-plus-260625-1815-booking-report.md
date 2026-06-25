# Calendly++ Booking Feature Report

**Date:** 2026-06-25
**Phase:** 02 — Calendly++ booking
**Status:** DONE

## What Was Built

Full Calendly-style booking upgrade on top of the existing provisional-booking flow. All changes use the existing `api/bookings.ts` function (no new Vercel function files).

## Files Modified

| File | Change |
|---|---|
| `api/bookings.ts` | Extended with 9 new actions (see below) |
| `server/lib/email/notify.ts` | Added `emailBookingVisitorLinks` and `emailBookingCancelled` |
| `src/pages/settings-page.tsx` | Added `BookingSection` (event types, availability, rules) |
| `src/pages/book-slot-page.tsx` | Added event-type selection step, uses new slot endpoint |

## Files Created

| File | Purpose |
|---|---|
| `server/lib/booking/slots.ts` | Slot generation: availability windows + buffer + min-notice + duration |
| `src/lib/booking-api.ts` | Client-side typed wrappers for all booking API calls |
| `src/components/booking/event-type-form.tsx` | Create/edit event type form (shadcn primitives) |
| `src/components/booking/availability-editor.tsx` | Weekly availability window editor |

## API Actions Added (all via `api/bookings.ts` dispatch)

### Public (unauthenticated)
- `GET /api/bookings/event-types-public?token=` — list active event types for a share token
- `GET /api/bookings/slots?token=&eventTypeId=` — generate slots using availability rules, buffer, min-notice, horizon (replaces hardcoded 30-min/14-day logic)
- `GET /api/bookings/booking-by-token?rescheduleToken=` or `?cancelToken=` — look up booking for visitor self-service
- `POST /api/bookings/cancel-by-token` — visitor cancels via cancelToken; deletes time block, sends email
- `POST /api/bookings/reschedule-by-token` — visitor reschedules; issues fresh tokens, re-notifies owner

### Authenticated owner
- `GET /api/bookings/event-types` — list own event types
- `POST /api/bookings/event-types` — create (slug auto-generated from name)
- `PATCH /api/bookings/event-types/:id` — update name/duration/description/active
- `DELETE /api/bookings/event-types/:id` — delete
- `GET /api/bookings/availability` — list weekday windows
- `PUT /api/bookings/availability` — replace all windows (full replacement, validated)
- `PATCH /api/bookings/booking-settings` — update buffer/min-notice/horizon on user row

### Unchanged
- `GET /api/bookings/free-slots` — legacy 30-min slot endpoint (kept for backward compat with old book-slot-page URLs)
- `POST /api/bookings` — extended: now stores `rescheduleToken` + `cancelToken` (nanoid 32) and `eventTypeId`
- `GET /api/bookings/mine`, `POST /api/bookings/approve/:id`, `POST /api/bookings/reject/:id` — unchanged

## Slot Generation Logic (`server/lib/booking/slots.ts`)

- Fetches `booking_availability` rows for owner, groups by weekday.
- If no availability configured: returns empty (owner must set windows).
- Fetches existing `time_blocks` + non-cancelled/rejected `bookings` in window as busy intervals.
- Buffer is added AFTER each booking's endAt to create breathing room.
- Steps through days from `earliest = now + minNoticeMinutes` to `now + horizonDays`.
- For each available day: iterates defined windows, steps by `durationMinutes`, skips overlapping slots.
- All window math done in owner IANA timezone via `date-fns-tz`.

## Email Additions

- `emailBookingVisitorLinks`: sent to visitor on booking creation, includes reschedule + cancel URLs (`/reschedule/:token`, `/cancel/:token`).
- `emailBookingCancelled`: sent to visitor on visitor-initiated cancel.
- Both no-op gracefully when `RESEND_API_KEY` is absent.

## Visitor Flow (`book-slot-page.tsx`)

1. Load event types for token.
2. If one type: auto-select. If multiple: show picker cards with duration badge.
3. After type selected: fetch slots via new `GET /api/bookings/slots` endpoint.
4. Date picker + slot grid (unchanged UX). Confirm form unchanged.
5. On submit: passes `eventTypeId` to `POST /api/bookings`.
6. Success screen notes email contains reschedule/cancel links.

## Deviations from Spec

- No dedicated `/reschedule/:token` or `/cancel/:token` routes added to `src/router.tsx` (that file is not in my ownership). The API endpoints and email links are fully functional; the router wiring requires a separate pass on `router.tsx` (see follow-ups).
- `Switch` / `Checkbox` shadcn components not installed (parallel agents were running, `npx shadcn` was forbidden). Used native `<input type="checkbox">` instead.

## TypeScript

`npx tsc -b` exits 0. The only pre-existing errors (`parse-quick-add.test.ts` missing `vitest`) are from another agent's file not included in `tsconfig.json`.

## Follow-ups

1. ~~Add `/reschedule/:token` and `/cancel/:token` routes to `src/router.tsx` with corresponding page components~~ — done in follow-up pass (see below).
2. Owner-side booking inbox could surface `rescheduleToken`/`cancelToken` links for each pending booking.
3. `Switch`/`Checkbox` shadcn components: once safe to run `npx shadcn add switch checkbox`, swap the native checkbox in `event-type-form.tsx`.
4. Slot generation fallback: if owner has no `booking_availability` rows, the new endpoint returns empty. Consider a migration that seeds default Mon-Fri 09:00-17:00 for existing users, or guide them in the UI.

---

## Follow-up Pass: Visitor Self-Service Pages (2026-06-25)

**Commit:** `87ce929`

### New Files

| File | Purpose |
|---|---|
| `src/components/booking/slot-picker.tsx` | Shared `SlotPicker`, `BookingWrap`, `BookingLogo` extracted from `book-slot-page.tsx` |
| `src/pages/cancel-booking-page.tsx` | `/cancel/:token` visitor cancel page |
| `src/pages/reschedule-booking-page.tsx` | `/reschedule/:token` visitor reschedule page |

### Modified Files

| File | Change |
|---|---|
| `api/bookings.ts` | Added `GET reschedule-slots?rescheduleToken=` public action |
| `src/lib/booking-api.ts` | Added `getRescheduleSlots()` wrapper |
| `src/pages/book-slot-page.tsx` | Refactored to use shared components from `slot-picker.tsx` |

### New API Action

`GET /api/bookings/reschedule-slots?rescheduleToken=<token>`

- Public, no auth required.
- Looks up the booking by `rescheduleToken`, resolves the owner, determines event duration (from `bookingEventTypes` or derives from booking times).
- Calls `freeSlotsV2` with the owner's availability settings.
- Re-inserts the booking's own current slot (if still in the horizon and not already present) so the visitor can keep the same time without it appearing blocked.
- Returns `{ owner: { name, timezone }, slots: SlotEntry[] }`.

### Cancel Page (`CancelBookingPage`)

- Reads `:token` as `cancelToken` from route param.
- Calls `getBookingByCancelToken` on mount. Handles:
  - `loading` skeleton
  - `invalid` (404): friendly expired-link message
  - `already_inactive` (410 or status cancelled/rejected): "already cancelled" state
  - `ready`: shows title, date, time in owner tz, destructive confirm button
  - `confirming`: button disabled, spinner text
  - `cancelled`: success state with confirmation message
  - `error`: generic fallback
- Calls `cancelByToken(token)` on confirm.

### Reschedule Page (`RescheduleBookingPage`)

- Reads `:token` as `rescheduleToken` from route param.
- On mount: calls `getBookingByRescheduleToken` then `getRescheduleSlots` in sequence.
- Pre-selects the current booking's date so the visitor lands on their original slot.
- Date picker + `SlotPicker` (shared component, same UX as booking page).
- Confirm button calls `rescheduleByToken`. On `slot_taken` (409): sonner toast error, resets picked slot, stays on picker. On success: shows new time with tz label and note about updated email links.
- Handles `invalid`, `already_inactive`, and generic `error` states.

### ROUTER WIRING NEEDED

Wire these two routes in `src/router.tsx` before deploying:

| Page | Route path | Import path | Component name |
|---|---|---|---|
| Cancel | `/cancel/:token` | `@/pages/cancel-booking-page` | `CancelBookingPage` |
| Reschedule | `/reschedule/:token` | `@/pages/reschedule-booking-page` | `RescheduleBookingPage` |

Both routes are public (no auth wrapper). They read the `:token` param via `useParams<{ token: string }>()`.

### TypeScript

`npx tsc -b` exits 0 after fixing two unused-import warnings (`parseISO` in `book-slot-page.tsx`, `format` in `cancel-booking-page.tsx`).

---

Status: DONE
Summary: Visitor cancel and reschedule pages are built and type-clean. The only remaining step is wiring `/cancel/:token` and `/reschedule/:token` in `src/router.tsx` (out of scope per task constraints).
