# Recurring Time Blocks Implementation

## Overview
Add support for recurring time blocks (e.g., daily standup at 9am, weekly deep work session).

## Schema Changes
- Add `recurringRule` JSONB column to `timeBlocks` table
- Same structure as tasks.recurringRule

## Backend Changes
- Update `api/time-blocks.ts` to accept recurringRule
- Update `server/lib/recurring/materializer.ts` to materialize time blocks

## Frontend Changes  
- Add recurrence UI to `block-editor-dialog.tsx`
- Add visual indicator for recurring blocks
- Handle "this instance only" vs "all instances" on edit/delete

## Files to Modify
1. `server/lib/db/schema.ts`
2. `api/time-blocks.ts`
3. `server/lib/recurring/materializer.ts`
4. `src/components/planner/block-editor-dialog.tsx`
5. `src/components/planner/block-card.tsx`
