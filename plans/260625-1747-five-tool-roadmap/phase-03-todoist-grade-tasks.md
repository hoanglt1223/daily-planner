# Phase 03 — Todoist-grade tasks (brief)

Replaces: Todoist. Impact: Med-High. Effort: Med. New function: No.

## Problem
Tasks have category, priority, due date, subtasks, recurring. Missing: projects/labels, natural-language quick-add, and smart Today/Upcoming/Overdue views.

## Scope (to detail next round)
- **Projects + labels**: lightweight grouping beyond single `categoryId`. Labels are many-per-task.
- **Natural-language quick-add**: parse `"draft report fri 3pm !p1 #work @home"` → title + dueDate + priority + project/label. Client-side parser (no new dep needed; small grammar).
- **Smart views**: Today, Upcoming (next 7d), Overdue, By-label filters on existing tasks list.

## Reuses
- `api/tasks.ts`, existing `quick-task-dialog.tsx`, `tasks-page.tsx`, priority + dueDate fields already in schema.

## Function-count impact
None. Extend `api/tasks.ts`.

## Schema (additive)
- `projects` (userId, name, color) — or reuse/rename `categories` as projects (decide; avoid churn).
- `labels` (userId, name) + `task_labels` join, OR a `text[]`/jsonb `labels` column on `tasks` (KISS — prefer jsonb array unless filtering at scale).
- Run `npm run db:push` if columns/tables added.

## Risks
- Don't duplicate `categories` vs `projects` — pick one model.
- NL parser scope creep: ship a small deterministic grammar (date words, `!p1-4`, `#project`, `@label`), not a full NLP engine.
