# Team Activity Feed - Implementation Plan

## Overview
Implement a unified activity feed that tracks team actions and system events across the daily planner application.

**Priority:** Medium  
**Status:** Planning  
**Complexity:** Medium (DB schema + API + UI)

## Requirements

### Functional Requirements
1. **Activity Storage** - Record all significant user actions in centralized log
2. **Activity Feed UI** - Display filtered activity stream on dashboard
3. **Real-time Updates** - Show recent activities without page refresh
4. **Privacy Controls** - Respect existing privacy settings for cross-team visibility
5. **Filtering** - Filter by activity type, date range, and user

### Non-Functional Requirements
1. Performance - Query time < 500ms for last 100 activities
2. Storage - Efficient JSON storage, implement cleanup after 90 days
3. Privacy - Follow existing manager/privacy model from time-blocks

## Architecture

### Database Schema

**New Table:** `activity_log`
```sql
- id: serial primary key
- userId: uuid references users(id)
- action: varchar(50) -- task_completed, task_created, booking_approved, achievement_unlocked, etc.
- entityType: varchar(50) -- task, booking, achievement, user, comment
- entityId: uuid
- metadata: jsonb -- { title, priority, assignee, etc. }
- createdAt: timestamp default now()
- teamId: uuid nullable -- for cross-team filtering
```

### API Changes

**New Endpoint:** Extend `/api/reports` (reuse existing function)
- `GET /api/reports/activities?from=&to=&type=&userId=`

**Modifications:** Add activity recording to existing endpoints:
- `/api/tasks` - Record create/update/complete/delete
- `/api/bookings` - Record approve/reject/create
- `/api/achievements` - Record unlock
- `/api/auth` - Record role changes, user joins

### UI Components

**New Components:**
1. `ActivityFeed.tsx` - Main feed component with filtering
2. `ActivityItem.tsx` - Individual activity display
3. `ActivityIcon.tsx` - Action-specific icons (check, calendar, trophy, etc.)

**Integration:**
- Add to dashboard page as collapsible card
- Add to manager page for team monitoring
- Optional: Add as modal/overlay via Quick Capture (⌘K)

## Implementation Steps

### Phase 1: Database & API
1. **Schema Update**
   - Add `activity_log` table to `server/lib/db/schema.ts`
   - Run `npm run db:push` to apply schema

2. **API Layer**
   - Add activity recording helper to `server/lib/activity-logger.ts`
   - Extend `/api/reports` with activities endpoint
   - Inject recording into existing endpoints (tasks, bookings, achievements)

3. **Permissions**
   - Reuse existing `requireAuth` / `tryAuth` middleware
   - Apply manager/privacy logic (respect `users.privacy` field)

### Phase 2: Frontend Components
4. **Activity Components**
   - Create `ActivityFeed.tsx` with filter controls
   - Create `ActivityItem.tsx` for individual items
   - Create `ActivityIcon.tsx` for action mapping

5. **Dashboard Integration**
   - Add to `dashboard-page.tsx` as collapsible card
   - Implement real-time polling (30s intervals)
   - Add "Mark all as read" functionality

6. **Manager Page Integration**
   - Add team activity view to `manager-page.tsx`
   - Filter by managed users only

### Phase 3: Testing & Polish
7. **Testing**
   - Test activity recording across all endpoints
   - Test privacy controls (manager vs non-manager)
   - Test filter performance

8. **UI Polish**
   - Add activity type icons with animations
   - Add relative timestamps ("2 minutes ago")
   - Empty states with helpful messaging

## Files to Modify

### Database
- `server/lib/db/schema.ts` - Add activity_log table

### Backend
- `server/lib/activity-logger.ts` - New helper for recording activities
- `api/reports.ts` - Add activities endpoint
- `api/tasks.ts` - Inject activity recording
- `api/bookings.ts` - Inject activity recording  
- `api/achievements.ts` - Inject activity recording
- `api/auth.ts` - Inject activity recording for role changes

### Frontend
- `src/components/dashboard/activity-feed.tsx` - New main component
- `src/components/dashboard/activity-item.tsx` - New item component
- `src/components/dashboard/activity-icon.tsx` - New icon mapper
- `src/pages/dashboard-page.tsx` - Integrate feed
- `src/pages/manager-page.tsx` - Add team activity view

## Success Criteria

- [ ] Activities recorded for all major user actions
- [ ] Activity feed displays on dashboard with < 500ms load time
- [ ] Privacy controls respected (managers see team, users see self)
- [ ] Filters work by type, date, user
- [ ] Real-time updates every 30s
- [ ] Mobile responsive
- [ ] No breaking changes to existing features

## Risk Assessment

**Medium Risk:**
- Performance impact on existing endpoints (mitigation: async recording)
- Storage growth (mitigation: 90-day cleanup job)
- Privacy complexity (mitigation: reuse existing permission logic)

**Low Risk:**
- UI complexity (standard feed pattern)
- Breaking changes (additive only, no schema migrations to existing tables)

## Next Steps

1. Create database migration
2. Build activity recording helper
3. Implement API endpoint
4. Build UI components
5. Test and integrate
