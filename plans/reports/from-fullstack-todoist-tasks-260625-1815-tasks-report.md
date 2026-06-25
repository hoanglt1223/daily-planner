# Todoist-grade tasks — implementation report

**Date:** 2026-06-25 | **Phase:** 03

---

## What was built

### 1. Labels (backend + UI)

- `api/tasks.ts`: POST and PATCH now accept and persist `labels: string[]`. GET accepts `?label=<name>` query param for server-side label filtering (JS-side filter after DB query; avoids jsonb operator complexity at this data scale).
- `src/pages/tasks-page.tsx`: `Task` type extended with `labels: string[]`. Label chips appear on each task row — clicking one activates `labelFilter`. Active filter shown as a dismissible chip. `LabelsInput` component (inline in page file) handles add/remove in New Task and Edit Task dialogs. Labels are preserved on duplicate.

### 2. Natural-language quick-add

- New file: `src/lib/parse-quick-add.ts`
- New file: `src/lib/parse-quick-add.test.ts`

Supported grammar (deterministic, no NLP library):

| Token | Example | Result |
|---|---|---|
| `!p1..!p4` | `!p1` | priority 1..4 |
| `#word` | `#work` | categoryName (first); label (subsequent) |
| `@word` | `@home` | label(s), multiple allowed |
| `today` / `tomorrow` | `today` | dueDate = today / +1 day |
| weekday short/full | `fri`, `friday` | next occurrence of that weekday (same day if today matches) |
| `NHam/pm` | `3pm`, `9am` | dueTime HH:MM 24h |
| `N:MMam/pm` | `3:30pm` | dueTime with minutes |
| `HH:MM` | `14:00` | dueTime 24h bare |

Parser tested: 21 cases via Node (esbuild bundle), all pass.

Quick-add bar is wired into `TasksPage` above the smart-view tabs. It shows a live preview line (parsed title, date badge, priority badge, category tag, label tags) as the user types. On submit it resolves `categoryName` to a `categoryId` from the loaded categories list (case-insensitive match).

### 3. Smart views

Seven filter tabs above the task list:

| Tab | Logic |
|---|---|
| Active | status not done/archived |
| Today | dueDate falls within today's local calendar day |
| Upcoming | dueDate within next 7 days, excluding today |
| Overdue | dueDate before today AND status not done/archived |
| Done | status = done |
| Archived | status = archived |
| All | no filter |

"Overdue" tab displays with red text when count > 0 and not selected.

The smart-view tabs replace the old status-chip row (Active/Done/Archived/All). Counts are computed client-side from the full task list — no extra API round-trips.

---

## Files modified / created

| File | Change |
|---|---|
| `api/tasks.ts` | Added labels to POST/PATCH; added `?view` and `?label` query support in GET |
| `src/pages/tasks-page.tsx` | Full rewrite on top of existing uncommitted changes: quick-add bar, smart views, label filter, labels in dialogs and task row |
| `src/lib/parse-quick-add.ts` | New — NL parser |
| `src/lib/parse-quick-add.test.ts` | New — 21 test cases with vitest-compatible declare stubs |

Files NOT touched: schema, router, api-client, auth-middleware, quick-task-dialog, bookings, reports, time-blocks, booking/*, capacity/*, settings-page, manager-page.

---

## Type check

`npx tsc -b` exits 0. Errors in untouched files (settings-page, manager-page, booking/event-type-form) existed before this work and are outside file ownership scope.

## Tests

Vitest not installed in this repo. Parser verified by bundling with esbuild and running 21 assertions via Node — all pass. Test file compiles clean under tsc via `declare function` stubs (no vitest package required at compile time).

---

## Deviations / notes

- `?view` param on the GET endpoint was added but the frontend currently filters client-side (all tasks fetched once, views computed in JS). The server-side `view` param is available for future optimization if task lists grow large.
- `dueTime` from quick-add is parsed and shown in the preview badge but is NOT persisted to the database (the schema `dueDate` column is a timestamp, so time could be encoded, but the current UI date pickers only handle date-only input). This is a known gap; the quick-add time token is surfaced as a badge for UX feedback.
- Categories are surfaced in the UI as "Projects" per the spec decision ("categories table IS the single project grouping"). The category manager dialog title updated to "Manage projects".

## Unresolved questions

- Should `dueTime` from quick-add set the time portion of the `dueDate` timestamp? Currently no — the date picker in the dialog is `type="date"` only. Needs a product decision before wiring.
- Label filtering is post-DB in JS. Fine for personal scale; if multi-tenant or large datasets needed, switch to `WHERE labels @> '["tag"]'::jsonb` with a GIN index.
