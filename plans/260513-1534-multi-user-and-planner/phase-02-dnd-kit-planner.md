# Phase 02 — Planner with @dnd-kit

**Status:** Pending · **Priority:** P0 · **Depends on:** Phase 01

## Overview

Replace `planner-page.tsx` stub with a real day/week grid. Tasks from backlog (kanban column on the left) can be dragged onto 30-min calendar cells on the right. Dropping creates a `time_block`. Existing blocks can be drag-resized and drag-moved within the grid.

## Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities date-fns-tz
```

## Components (`src/components/planner/`)

| File | Purpose | LOC budget |
|---|---|---|
| `planner-grid.tsx` | Week/day grid wrapper, owns DndContext | 150 |
| `time-column.tsx` | Single day column with 30-min cells (droppable) | 80 |
| `block-card.tsx` | Rendered time_block (draggable + resizable) | 100 |
| `backlog-column.tsx` | Kanban tasks list (draggable cards) | 80 |
| `capacity-summary.tsx` | Today/week free vs. booked totals | 60 |
| `use-blocks.ts` | Hook: fetch `/api/time-blocks?from&to`, optimistic mutate | 90 |
| `use-tasks.ts` | Hook: fetch `/api/tasks`, mutations | 80 |

Keep each file <200 lines (rule from CLAUDE.md).

## Drag semantics

- `DragStart` sets `activeId`.
- `DragOver` snaps to 30-min cell — visual ghost only.
- `DragEnd`:
  - Source = backlog task, target = grid cell → POST `/api/time-blocks` `{taskId, startAt, endAt = startAt + task.estimatedMinutes}`.
  - Source = existing block, target = different cell → PATCH block `{startAt, endAt shifted}`.
  - Source = resize handle → PATCH block `{endAt}`.
- Optimistic update; on error revert + toast.

## Views

- `?view=day&date=YYYY-MM-DD` — single column, hour rows 6am–10pm
- `?view=week&date=YYYY-MM-DD` — 7 columns (Mon–Sun in user TZ), same hour rows

## Capacity logic (client-side)

```
workdayMinutes  = 16 * 60        // 6am-10pm window, configurable later
bookedMinutes   = sum(endAt-startAt) for blocks in range
freeMinutes     = workdayMinutes - bookedMinutes
freeRatio       = freeMinutes / workdayMinutes
```

Shown in `capacity-summary.tsx` as: `Booked 8h · Free 8h · 50% free`.

## Todo

- [ ] Install deps
- [ ] Build `planner-grid.tsx` with DndContext + sensors
- [ ] Build `time-column.tsx` droppable cells
- [ ] Build `block-card.tsx` draggable + resize handle
- [ ] Build `backlog-column.tsx`
- [ ] Hooks `use-blocks.ts`, `use-tasks.ts`
- [ ] Capacity summary
- [ ] Wire to `/planner` route, replace stub
- [ ] Test: drag from backlog → grid creates block; drag block → updates time

## Success criteria

- Dragging a backlog task onto Wednesday 14:00 cell creates a `time_block` of `task.estimatedMinutes` length starting at 14:00.
- Resize handle changes `endAt`.
- Capacity summary updates after every mutation.
- Keyboard navigation works (dnd-kit Keyboard sensor).

## Risks

- Mobile: touch DnD needs `TouchSensor` with delay/tolerance.
- Performance: 7 cols × 32 cells = 224 droppables per week — fine for dnd-kit but virtualize if user has 100+ blocks.
