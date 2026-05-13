# Phase 03 — Recurring materializer (3-week window)

**Status:** Pending · **Priority:** P1 · **Depends on:** Phase 01

## Overview

Lazy expansion of `tasks.recurringRule` into `time_blocks` rows. Limit horizon to **today + 21 days**. No background scheduler — runs on read.

## Rule shape (already in schema)

```ts
recurringRule: {
  freq: 'daily' | 'weekly' | 'monthly',
  byDay?: ['MO','WE','FR'],   // weekly only
  interval?: number,            // every N
  until?: string,               // ISO date
  defaultTime?: 'HH:MM',        // e.g. '09:00' → block startAt in user TZ
  defaultDurationMinutes?: number,
} | null
```

## Algorithm

```
materialize(userId):
  user = SELECT users WHERE id = userId
  horizon = max(today, user.materialized_until or epoch) ... today + 21d
  if horizon.from > horizon.to: return  // already covered
  tasks = SELECT tasks WHERE userId = userId AND recurringRule IS NOT NULL
  for task in tasks:
    occurrences = expand(task.recurringRule, horizon.from, horizon.to, user.timezone)
    for occ in occurrences:
      INSERT time_blocks (taskId, title=task.title, startAt=occ.start, endAt=occ.end, status='planned')
        ON CONFLICT (taskId, startAt) DO NOTHING
  UPDATE users SET materialized_until = today + 21d WHERE id = userId
```

Add unique constraint `(taskId, startAt)` on `time_blocks` for idempotency.

## Where to call

- Inside `api/time-blocks.ts` GET handler — call `materializeIfStale(userId)` before query.
- Inside `api/share.ts` GET handler — same, for share view requests.

## Module

New file: `server/lib/recurring/expand.ts` (<150 lines)
- `expand(rule, from, to, tz): Array<{start: Date, end: Date}>`
- Pure function, easy to unit-test.

## Todo

- [ ] Add unique index `(taskId, startAt)` on `time_blocks` in schema
- [ ] `db:push`
- [ ] Build `server/lib/recurring/expand.ts`
- [ ] Build `server/lib/recurring/materializer.ts` (DB orchestration)
- [ ] Hook into `api/time-blocks.ts` GET
- [ ] Update task PATCH — if `recurringRule` changes, clear future un-completed blocks before re-materializing
- [ ] Manual test: create weekly task → GET blocks for next 3 weeks → see rows

## Success criteria

- Creating a "Mon-Wed-Fri 9:00–9:30" recurring task auto-creates 9 blocks (3 weeks × 3 days).
- Reading week 4 from now does NOT create blocks beyond the horizon.
- Editing `recurringRule` regenerates future blocks; past completed blocks untouched.

## Risks

- DST transitions in `Asia/Bangkok` — none (UTC+7 no DST). Safe.
- User changes timezone — re-materialize from scratch (delete future planned blocks linked to recurring tasks, reset cursor).
