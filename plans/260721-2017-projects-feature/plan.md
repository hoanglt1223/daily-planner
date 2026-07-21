# Projects Management System - Implementation Plan

**Date:** 2026-07-21  
**Status:** In Progress  
**Complexity:** Medium

## Overview
Add project-based organization to the daily planner, allowing users to group related tasks under projects with progress tracking and status management.

## Key Features
1. **Projects CRUD** - Create, read, update, delete projects
2. **Task-project association** - Link tasks to projects
3. **Progress tracking** - Visual progress indicators per project
4. **Status management** - Active, completed, archived, on-hold
5. **Dashboard integration** - Show active projects

## Implementation Steps

### Phase 1: Database Schema
1. Add `projects` table to `server/lib/db/schema.ts`
2. Add `projectId` column to `tasks` table
3. Run `npm run db:push` to apply schema changes

### Phase 2: API Layer
1. Create `api/projects.ts` with CRUD operations
2. Endpoints:
   - GET `/api/projects` - List all projects
   - POST `/api/projects` - Create project
   - PATCH `/api/projects/:id` - Update project
   - DELETE `/api/projects/:id` - Delete project
3. Update `api/tasks.ts` to handle `projectId` field

### Phase 3: UI Components
1. Create `src/pages/projects-page.tsx`
2. Add project card components
3. Create project form dialog (create/edit)
4. Update `src/pages/tasks-page.tsx` to include project selector
5. Add navigation link to `src/components/app-layout.tsx`

### Phase 4: Dashboard Integration
1. Create `src/components/dashboard/project-progress.tsx`
2. Add active projects section to dashboard
3. Update `src/pages/dashboard-page.tsx`

## Files to Modify
- `server/lib/db/schema.ts` - Add projects table
- `api/projects.ts` - New API function  
- `src/pages/projects-page.tsx` - New page
- `src/pages/tasks-page.tsx` - Add project assignment
- `src/router.tsx` - Add projects route
- `src/components/app-layout.tsx` - Add nav link

## Success Criteria
- Can create and manage projects via UI
- Tasks can be assigned to projects
- Project progress is visible on dashboard
- All existing functionality remains intact
