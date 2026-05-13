# Phase 01 — Schema & roles

**Status:** Pending · **Priority:** P0 (blocks all other phases)

## Overview

Extend Drizzle schema: add manager mapping, share tokens, privacy settings, bookings, and materialization cursor. Then `npm run db:push` against Neon.

## Changes to `server/lib/db/schema.ts`

```ts
export const userRole = pgEnum('user_role', ['user', 'manager', 'admin']); // add 'manager'
export const privacyMode = pgEnum('privacy_mode', ['details_to_managers', 'busy_only_to_managers', 'private']);
export const bookingStatus = pgEnum('booking_status', ['pending', 'approved', 'rejected', 'cancelled']);

// users: add columns
shareToken: text('share_token').unique(),         // nanoid(16), nullable until enabled
privacy: privacyMode('privacy').notNull().default('busy_only_to_managers'),
timezone: text('timezone').notNull().default('Asia/Bangkok'),
materializedUntil: timestamp('materialized_until', { withTimezone: true }),

// new table: manager_users
export const managerUsers = pgTable('manager_users', {
  managerId: uuid('manager_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.managerId, t.userId] })]);

// new table: bookings
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  timeBlockId: uuid('time_block_id').references(() => timeBlocks.id, { onDelete: 'set null' }),
  visitorName: text('visitor_name').notNull(),
  visitorEmail: text('visitor_email').notNull(),
  title: text('title').notNull(),
  note: text('note'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  status: bookingStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('bookings_owner_status_idx').on(t.ownerUserId, t.status)]);
```

## Migration order

1. Update `schema.ts`.
2. `npm run db:generate` → review SQL.
3. `npm run db:push` to apply.
4. Backfill: existing users get `privacy = 'busy_only_to_managers'`, `timezone = 'Asia/Bangkok'`, `shareToken = NULL` (lazy).

## API touchpoints

- `api/auth.ts` — `me` returns new fields.
- `api/admin.ts` — add actions: `assign-manager` (POST `{ managerId, userId }`), `unassign-manager`, `list-mappings`. Update `set-role` to allow `'manager'`.

## Todo

- [ ] Add `manager` to `userRole` enum + new enums
- [ ] Add columns to `users`
- [ ] Add `managerUsers` + `bookings` tables
- [ ] Run `db:generate` + commit migration
- [ ] Run `db:push` to Neon
- [ ] Update `api/admin.ts` for manager mapping CRUD
- [ ] Update `api/auth.ts` me-response shape

## Success criteria

- `db:push` runs without errors against Neon
- Existing register/login still works
- Admin can promote a user to `manager` and map users via `/api/admin/assign-manager`

## Risks

- Adding NOT-NULL enum requires default — handled via `.default()`.
- `shareToken` is unique nullable — Postgres allows multiple NULLs, fine.
