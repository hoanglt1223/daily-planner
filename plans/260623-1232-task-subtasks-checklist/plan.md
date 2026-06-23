# Plan: Task Subtasks Checklist

## Overview
Add a subtasks/checklist feature to tasks. Each task can have a list of sub-items with checkboxes, progress tracking, and inline editing. This lets users break down complex tasks into smaller actionable steps.

## Why
- Tasks with `estimatedMinutes` assume one monolithic block. Real work is often multi-step.
- Subtasks give visibility into progress ("3 of 5 done") without creating separate top-level tasks.
- Common feature in Todoist, Asana, Linear — users expect it.

## Approach

### Data Model
- Add `subtasks` JSONB column to `tasks` table: `Array<{ id: string; title: string; done: boolean }>`
- Each subtask gets a nanoid for stable identity
- No new table needed — stays within Neon free tier

### Files to Change

1. **`server/lib/db/schema.ts`** — Add `subtasks` jsonb column to `tasks` table
2. **`api/tasks.ts`** — Handle `subtasks` in POST/PATCH
3. **`src/components/planner/use-planner-data.ts`** — Add `subtasks` to Task type
4. **`src/components/planner/draggable-task-card.tsx`** — Show subtask progress bar on card, add subtask editing in TaskEditDialog
5. **`src/pages/tasks-page.tsx`** — Show subtask progress in task list, add subtask checklist to edit dialog
6. **`src/components/quick-task-dialog.tsx`** — Check if it needs updating (likely no change needed)

### Implementation Steps

1. **Schema**: Add `subtasks` jsonb field to tasks table in schema.ts
2. **API**: Wire `subtasks` through POST and PATCH in api/tasks.ts (already whitelists jsonb fields)
3. **Types**: Add `subtasks` to Task type in use-planner-data.ts
4. **UI - Planner card**: Show a mini progress indicator (e.g., "2/4 ✓") on the draggable task card
5. **UI - Task edit dialog (planner)**: Add a subtask checklist section to TaskEditDialog
6. **UI - Tasks page**: Add subtask progress indicator in task rows, add checklist to EditTaskDialog
7. **Build check**: Run `npx tsc -b` to verify no type errors

### Schema change
```ts
// In schema.ts, add to tasks table:
subtasks: jsonb('subtasks').$type<Array<{ id: string; title: string; done: boolean }>>().default([]),
```

### API change
In `api/tasks.ts`, add `'subtasks'` to the whitelist in the PATCH handler.

### UI Design
- **Card view**: Small "2/4 ✓" badge next to the priority badge
- **Expanded view / Edit dialog**: Interactive checklist with:
  - Checkbox per subtask
  - Inline text editing
  - Add new subtask input
  - Delete subtask button
  - Drag to reorder (stretch goal — skip for MVP)

## Success Criteria
- Tasks can have subtasks added/edited/removed
- Progress shown as "N/M done" on task cards
- Checklist is interactive in edit dialogs
- No build errors
- Existing functionality unchanged

## Risk
- Low risk — purely additive JSONB column with default `[]`
- No migration needed for existing data (default empty array)
