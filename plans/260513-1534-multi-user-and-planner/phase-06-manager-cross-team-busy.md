# Phase 06 — Manager + cross-team free/busy

**Status:** Pending · **Priority:** P2 · **Depends on:** Phase 01

## Overview

Manager users can see free/busy of users mapped to them via `manager_users`. Cross-team works too — there's no team table; mapping is the only authority. Privacy gate uses the **target user's** `privacy` setting.

## Endpoint additions

Extend `api/time-blocks.ts`:

| Query | Behavior |
|---|---|
| `?viewUser=<uuid>` | viewer must be: target itself, OR `admin`, OR have row in `manager_users` for target |

Response respects target's `privacy`:
- viewer is target/admin → full
- viewer is manager + privacy `details_to_managers` → full
- viewer is manager + privacy `busy_only_to_managers` → titles redacted to `"Busy"`
- viewer is manager + privacy `private` → 403

## New endpoint: directory

Add action to `api/admin.ts` (no new function):

| Method | Path | Auth | Behavior |
|---|---|---|---|
| GET | `/api/admin/managed-users` | manager OR admin | list users I manage (or all for admin) |
| POST | `/api/admin/assign-manager` | admin | `{managerId, userId}` |
| POST | `/api/admin/unassign-manager` | admin | `{managerId, userId}` |

## Frontend

- New page `src/pages/manager-page.tsx`:
  - Sidebar: list of managed users
  - Main: read-only week view of selected user
  - Top filter: "Show details (when allowed)" vs. "Busy only"
- Add `/manager` to nav for `role in (manager, admin)`.

## Todo

- [ ] `viewUser` query support in `api/time-blocks.ts` with privacy gate
- [ ] Admin actions for manager mapping
- [ ] `manager-page.tsx`
- [ ] Role-gated nav item in `app-layout.tsx`
- [ ] `/me` returns `role` so client can gate nav

## Success criteria

- Admin maps manager A → user B
- Manager A logs in, sees B in managed list
- Viewing B's week respects B's privacy setting
- Non-manager regular user CANNOT call `?viewUser=B` → 403

## Risks

- N+1 query when manager lists many users with their weeks — fetch lazily (only the selected user).
- Privacy bypass via `/api/share/:token` is a separate path — fine, that's intentionally public.

## Open

- Should manager be able to *create* time_blocks on a managed user's calendar? Default **no**; add later if requested.
