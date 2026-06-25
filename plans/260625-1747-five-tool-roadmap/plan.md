# Five-Tool Roadmap — close gaps so Daily Planner credibly replaces Kanban × Calendar × Timesheet × Calendly × Todoist

**Status:** Features 1, 2, 3 IMPLEMENTED (read-only capacity board; Calendly++ booking with reschedule/cancel; Todoist-grade tasks). Feature 4 DEFERRED (needs Google Cloud OAuth app + secrets that cannot be provisioned autonomously; brief is implementation-ready). Schema pushed to Neon. Verified: tsc + vite build + eslint all green.
**Created:** 2026-06-25
**Branch:** master
**Audience:** personal users + small teams / SMEs.

## Goal

Sequence four gap-closing features. Each maps to a tool the product claims to replace. Order by impact, effort, dependency, and Vercel Hobby function-count risk (cap 12, target ≤8, current 7).

## Already shipped (do not re-plan)

Subtasks, due dates, pinning, recurring rules, pomodoro + focus timers, ICS export, timesheet export, streak calendar, productivity insights, bookings inbox, manager view, daily notes, cross-team free/busy with 3 privacy tiers.

## Sequence

| # | Feature | Replaces | Impact | Effort | New fn? | Status | Brief |
|---|---------|----------|--------|--------|---------|--------|-------|
| 1 | Team capacity board | (differentiator) | High | Med | No (extend `time-blocks`/`reports`) | ✅ Done (read-only; assign-into-slot deferred) | [phase-01](./phase-01-team-capacity-board.md) |
| 2 | Calendly++ booking | Calendly | High | Med | No (extend `bookings`) | ✅ Done | [phase-02](./phase-02-calendly-plus-booking.md) |
| 3 | Todoist-grade tasks | Todoist | Med-High | Med | No (extend `tasks`) | ✅ Done | [phase-03](./phase-03-todoist-grade-tasks.md) |
| 4 | Google/Outlook calendar sync | Calendar | High | High | **Yes (risk)** | ⏸ Deferred (needs OAuth app + secrets) | [phase-04](./phase-04-external-calendar-sync.md) |

### Why this order

- **1 first** — pure leverage on existing assets (`?viewUser=` free/busy, `manager_users`, privacy tiers). No new external deps, no schema risk. Directly serves the SME story and the core "capacity check" value, so highest strategic ROI per unit effort.
- **2 second** — biggest *functional* gap vs a named competitor (booking is hardcoded 30-min / 14-day). Self-contained in `bookings` + `/book/:token`. Email confirm reuses optional `RESEND_API_KEY`.
- **3 third** — mostly frontend + additive `tasks` columns. Independent of 1/2. Lower risk, can slot in any time.
- **4 last** — highest effort and risk: OAuth, token storage, webhook/poll sync, conflict resolution, 10s timeout, and likely a **new serverless function** (pushes 7 → 8/9, still under cap but the only item that threatens it). Sequenced after booking so conflict-aware logic builds on a finished booking flow.

## Dependencies

- 1, 2, 3 are mutually independent (different functions/tables) — could parallelize if staffed.
- 4 depends conceptually on 2 (booking conflict checks should respect synced external busy).
- Function-count budget is the shared constraint: keep 1-3 inside existing functions; reserve the one spare slot for 4.

## Acceptance criteria (roadmap level)

- Each feature has its own phased plan authored before implementation.
- No feature breaks the ≤8 function target without explicit sign-off (only #4 is at risk).
- Schema changes documented + `npm run db:push` noted in each phase plan.
- Landing page (now claims all 5) stays truthful: a feature ships before its claim is emphasized in marketing.

## Open questions

- #4: Google only, or Google + Outlook (Microsoft Graph)? Two providers ≈ double OAuth/sync work.
- #2: per-user single availability, or multiple named event types from day one?
- Should #1 allow managers to *write* (assign blocks into a user's free slot), or read-only capacity first?
