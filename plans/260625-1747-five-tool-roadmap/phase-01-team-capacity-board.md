# Phase 01 — Team capacity board (brief)

Replaces: (differentiator — the reason the product exists). Impact: High. Effort: Med. New function: No.

## Problem
Manager today can view one user's free/busy at a time via `?viewUser=`. No single screen to see the whole team's capacity and drop urgent work into a free slot.

## Scope (to detail next round)
- Manager screen: rows = mapped users (`manager_users`), columns = days of selected week, cell = booked vs free hours (respecting each user's `privacy` tier).
- Aggregate free-hours per user/day from existing `time_blocks` + capacity logic already in `reports`/`capacity-summary`.
- Optional write: assign a task into a chosen user's free slot (creates a `time_blocks` row owned by that user). Decide read-only vs write (see open question in plan.md).

## Reuses (no new deps)
- `?viewUser=` authorization + privacy redaction in `api/time-blocks.ts`.
- `manager_users` mapping, `api/reports.ts` capacity math, `src/components/planner/capacity-summary.tsx`.

## Function-count impact
None. Extend `api/reports.ts` (e.g. `kind=team-capacity`) and/or `api/time-blocks.ts` batch fetch.

## Schema
Likely none for read-only. Write mode reuses existing `time_blocks`.

## Risks
- Privacy correctness: must reuse existing redaction so `busy_only`/`private` users are never over-exposed in the aggregate.
- N users × 7 days fan-out under 10s timeout — batch in one query, not per-user.
