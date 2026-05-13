# Plan: Multi-user + Planner Grid + Booking

Created: 2026-05-13 · Status: Draft · Branch: `master`

## Goal

Extend the scaffolded `daily-planner` into a multi-user app with:
- Roles: `user | manager | admin` (manager–user mapping is m:n)
- Shareable read-only week view (per-user `share_token`)
- Calendly-style external booking on free slots
- Cross-team Google-Calendar-style free/busy lookup (with privacy: full details vs. busy-only)
- Time-blocked planner with drag-and-drop via `@dnd-kit`
- Recurring task expansion limited to a **rolling 3-week window** (today → +21d)

## Function budget

Vercel Hobby cap = 12, target ≤8. Current 5 → adding 2 (`share`, `bookings`). Total **7**. OK.

## Phase index

| # | Phase | Status |
|---|---|---|
| 01 | [Schema & roles](./phase-01-schema-and-roles.md) | Pending |
| 02 | [Planner with @dnd-kit](./phase-02-dnd-kit-planner.md) | Pending |
| 03 | [Recurring materializer (3-week window)](./phase-03-recurring-materializer.md) | Pending |
| 04 | [Shared read-only view](./phase-04-share-view.md) | Pending |
| 05 | [Book-slot flow (Calendly-style)](./phase-05-book-slot.md) | Pending |
| 06 | [Manager + cross-team free/busy](./phase-06-manager-cross-team-busy.md) | Pending |

## Key decisions (locked)

- **DnD lib:** `@dnd-kit/core` + `@dnd-kit/sortable` (~12kb gz, pointer+keyboard sensors, touch support).
- **Recurring strategy:** lazy materialization on read. When client requests blocks for date range `[from, to]`, server checks each task's `recurringRule` and ensures rows exist up to `min(to, today + 21d)`. Persisted via `users.materialized_until` cursor.
- **Manager mapping:** `manager_users(manager_id, user_id)` m:n. Manager sees mapped users' free/busy. Admin sees everyone.
- **Privacy on free/busy:** per-user `privacy` enum: `details_to_managers | busy_only_to_managers | private`. Default `busy_only_to_managers`.
- **Share token:** `users.share_token` (nanoid 16). Route `/u/:token` shows current + next 2 weeks read-only.
- **Booking flow:** external visitor at `/book/:token` sees 30-min free slots within next 14 days. Submits name/email/title → creates `bookings` row + provisional `time_block` (`status='pending'`). Owner approves/rejects in dashboard → block status → `planned` or block deleted.

## Dependencies to add

```
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
date-fns-tz
rrule        # parses RFC5545 if we ever go beyond our JSON shape; optional
```

Skip `rrule` until needed; current `recurringRule` JSON is enough.

## File ownership map

- Schema/migrations: `server/lib/db/schema.ts`
- New endpoints: `api/share.ts`, `api/bookings.ts`
- Extended endpoints: `api/time-blocks.ts` (free/busy + materialize), `api/admin.ts` (manager mapping)
- Planner UI: `src/pages/planner-page.tsx` + `src/components/planner/*`
- Share view: `src/pages/share-view-page.tsx`, `src/pages/book-slot-page.tsx`
- Router: `src/router.tsx`

## Unresolved questions

- Approve booking — email notification needed in MVP? (assume **no email**, owner just sees pending list)
- Cross-team free/busy: do non-managers ever see other users' busy? (assume **no**, only managers via `manager_users`)
- Time zone: store UTC, render in `Asia/Bangkok`. Per-user TZ override later.
