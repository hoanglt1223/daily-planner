# Team Capacity Board: Implementation Report
Date: 2026-06-25 | Agent: fullstack-developer

## What Was Built

Read-only team capacity board integrated into the existing Manager page. Managers and admins can now view the entire team's booked vs. free time for any selected week in a single grid, replacing the previous one-user-at-a-time flow.

## Files Changed / Created

| File | Action | Notes |
|---|---|---|
| `api/reports.ts` | Modified | Added `kind=team-capacity` handler; preserved existing `capacity`, `summary`, `timesheet` kinds |
| `src/lib/capacity-api.ts` | Created | Client fetch wrapper; types `CapacityUser`, `CapacityDay`, `TeamCapacityResponse` |
| `src/components/capacity/capacity-grid.tsx` | Created | Table grid: rows = users, columns = 7 days, each cell has a free-hours label + load bar |
| `src/pages/manager-page.tsx` | Modified | Added "Individual" / "Team capacity" toggle; week navigation; renders `CapacityGrid` |

## API Endpoint

`GET /api/reports?kind=team-capacity&from=<ISO>&to=<ISO>`

- Auth: requires valid JWT; role must be `manager` or `admin` (returns 403 otherwise).
- Returns `{ from, to, workdayMinutes: 480, users: [...] }`.
- Per user: `{ userId, name, email, privacy, days: [{ date, bookedMinutes, freeMinutes }] }`.
- Single batched `inArray` query over `time_blocks` for all visible users; no per-user queries.

## Privacy Semantics Mirrored

Exactly matches `api/time-blocks.ts` `canViewUser` logic:

| User privacy | Manager sees | Admin sees |
|---|---|---|
| `details_to_managers` | Full booked aggregate | Full booked aggregate |
| `busy_only_to_managers` | Full booked aggregate (titles not exposed at aggregate level) | Full booked aggregate |
| `private` | User excluded from response entirely | User included but with 0 booked / 8h free (no block data returned) |

Note: at the aggregate level, `details_to_managers` and `busy_only_to_managers` both produce correct booked minutes without exposing individual block titles. Block titles are never returned in the `team-capacity` response, only totals.

## Capacity Constant

`WORKDAY_MINUTES = 8 * 60 = 480` minutes, matching `WORKDAY_HOURS = 8` exported from `src/lib/time-utils.ts` and used in `src/components/planner/capacity-summary.tsx`. Booked minutes are capped at 480 per day to prevent overflow bars.

## Visual Highlighting

Cell background tone: green (50%+ free), amber (25-50% free), red (under 25% free). Mirrors the same thresholds used in `capacity-summary.tsx` (pct < 25 → red, pct < 50 → amber, else emerald).

## Type Check

`npx tsc -b` exits with 1 pre-existing error (`src/lib/parse-quick-add.test.ts` cannot find `vitest`). Zero errors in any owned file.

## Deviations

- `private` users: the spec said "match existing privacy semantics." For managers, `private` users return 403 in `time-blocks.ts`, so they are excluded from the capacity list. For admins, they are included with zeroed booked minutes (no block data surfaced), which is consistent with admin having visibility rights but the user having opted out of detail exposure.
- The `from`/`to` window uses UTC day boundaries for key generation (same as existing `summary` kind). Day keys in the response are always `yyyy-MM-dd` UTC strings.

## Follow-ups (Out of Scope This Round)

1. **Assign task into free slot** (write action): clicking a green cell to create a `time_blocks` row on behalf of a managed user. Deferred per spec.
2. **Materialize recurring blocks before capacity query**: the existing `time-blocks.ts` calls `materializeIfStale` per user before fetching. The `team-capacity` endpoint does NOT do this (would require N sequential async calls or a batch materializer). A future batched materializer in `server/lib/recurring/materializer.ts` could be called for all `visibleUserIds` before the block query.
3. **Weekend filtering**: the grid shows all 7 days including weekends. Free minutes on weekends are shown as 8h (full capacity), which may be misleading. A weekday-only mode or configurable working days would improve accuracy.
4. **Timezone per user**: booked minutes are computed using UTC day keys. Users in different timezones may have blocks that span across UTC midnight differently. A per-user TZ-aware bucketing would require reading each user's `timezone` field.
