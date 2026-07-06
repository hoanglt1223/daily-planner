import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, pgEnum, index, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'manager', 'admin']);
export const privacyMode = pgEnum('privacy_mode', ['details_to_managers', 'busy_only_to_managers', 'private']);
export const taskStatus = pgEnum('task_status', ['backlog', 'todo', 'doing', 'done', 'archived']);
export const blockStatus = pgEnum('block_status', ['planned', 'in_progress', 'completed', 'skipped', 'pending']);
export const bookingStatus = pgEnum('booking_status', ['pending', 'approved', 'rejected', 'cancelled']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: userRole('role').notNull().default('user'),
  shareToken: text('share_token').unique(),
  privacy: privacyMode('privacy').notNull().default('busy_only_to_managers'),
  timezone: text('timezone').notNull().default('Asia/Bangkok'),
  materializedUntil: timestamp('materialized_until', { withTimezone: true }),
  // Calendly-style booking config (owner-level defaults applied to every event type)
  bookingBufferMinutes: integer('booking_buffer_minutes').notNull().default(0),
  bookingMinNoticeMinutes: integer('booking_min_notice_minutes').notNull().default(0),
  bookingHorizonDays: integer('booking_horizon_days').notNull().default(14),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const managerUsers = pgTable('manager_users', {
  managerId: uuid('manager_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.managerId, t.userId] }),
  index('manager_users_user_idx').on(t.userId),
]);

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('categories_user_idx').on(t.userId)]);

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatus('status').notNull().default('todo'),
  priority: integer('priority').notNull().default(3),
  estimatedMinutes: integer('estimated_minutes').notNull().default(60),
  recurringRule: jsonb('recurring_rule').$type<{
    freq: 'daily' | 'weekly' | 'monthly';
    byDay?: string[];
    interval?: number;
    until?: string;
    defaultTime?: string;
    defaultDurationMinutes?: number;
  } | null>(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  isPinned: boolean('is_pinned').notNull().default(false),
  subtasks: jsonb('subtasks').$type<Array<{ id: string; title: string; done: boolean }>>().default([]),
  // Todoist-style free-form labels (categories serve as the single "project" grouping)
  labels: jsonb('labels').$type<string[]>().default([]),
  // Task dependency management (blocked by other tasks)
  blockedByTaskIds: jsonb('blocked_by_task_ids').$type<string[]>().default([]),
  // Task reminder settings (browser notifications)
  reminderEnabled: boolean('reminder_enabled').notNull().default(false),
  reminderMinutes: integer('reminder_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('tasks_user_status_idx').on(t.userId, t.status),
  index('tasks_user_category_idx').on(t.userId, t.categoryId),
]);

export const timeBlocks = pgTable('time_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  actualMinutes: integer('actual_minutes'),
  status: blockStatus('status').notNull().default('planned'),
  note: text('note'),
  energyLevel: integer('energy_level'), // 1-5 scale for subjective energy during task
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('blocks_user_start_idx').on(t.userId, t.startAt),
  index('blocks_task_idx').on(t.taskId),
  uniqueIndex('blocks_task_start_unique').on(t.taskId, t.startAt),
]);

// Named booking offerings (e.g. "15m intro", "30m call", "60m deep-dive").
export const bookingEventTypes = pgTable('booking_event_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('event_types_owner_idx').on(t.ownerUserId),
  uniqueIndex('event_types_owner_slug_unique').on(t.ownerUserId, t.slug),
]);

// Per-weekday availability windows in the owner's timezone (minutes from midnight).
export const bookingAvailability = pgTable('booking_availability', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(), // 0 = Sunday … 6 = Saturday
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('availability_owner_idx').on(t.ownerUserId)]);

export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventTypeId: uuid('event_type_id').references(() => bookingEventTypes.id, { onDelete: 'set null' }),
  timeBlockId: uuid('time_block_id').references(() => timeBlocks.id, { onDelete: 'set null' }),
  visitorName: text('visitor_name').notNull(),
  visitorEmail: text('visitor_email').notNull(),
  title: text('title').notNull(),
  note: text('note'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  status: bookingStatus('status').notNull().default('pending'),
  // Single-purpose nanoid tokens for visitor self-service reschedule / cancel links.
  rescheduleToken: text('reschedule_token'),
  cancelToken: text('cancel_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('bookings_owner_status_idx').on(t.ownerUserId, t.status),
  uniqueIndex('bookings_owner_start_unique').on(t.ownerUserId, t.startAt),
]);

export const dailyNotes = pgTable('daily_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  noteDate: timestamp('note_date', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('daily_notes_user_date_idx').on(t.userId, t.noteDate),
]);

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TimeBlock = typeof timeBlocks.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingEventType = typeof bookingEventTypes.$inferSelect;
export type BookingAvailability = typeof bookingAvailability.$inferSelect;
export type ManagerUser = typeof managerUsers.$inferSelect;
export type DailyNote = typeof dailyNotes.$inferSelect;
