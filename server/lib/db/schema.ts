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
  hourlyRate: integer('hourly_rate'), // Optional hourly rate for meeting cost calculations
  // Vacation/time-off balance tracking
  vacationDaysAvailable: integer('vacation_days_available').notNull().default(20),
  vacationDaysUsed: integer('vacation_days_used').notNull().default(0),
  vacationDaysAccrualRate: integer('vacation_days_accrual_rate').notNull().default(0), // Days per month
  vacationAccrualLastReset: timestamp('vacation_accrual_last_reset', { withTimezone: true }),
  // Focus/Pomodoro timer preferences
  focusWorkMinutes: integer('focus_work_minutes').notNull().default(25),
  focusBreakMinutes: integer('focus_break_minutes').notNull().default(5),
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
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
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
  index('tasks_user_project_idx').on(t.userId, t.projectId),
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
  isMeeting: boolean('is_meeting').notNull().default(false), // Flag for meeting vs work blocks
  isVacation: boolean('is_vacation').notNull().default(false), // Flag for vacation/time-off blocks
  calculatedCost: integer('calculated_cost'), // Stored cost for meetings
  recurringRule: jsonb('recurring_rule').$type<{
    freq: 'daily' | 'weekly' | 'monthly';
    byDay?: string[];
    interval?: number;
    until?: string;
    defaultTime?: string;
    defaultDurationMinutes?: number;
  } | null>(),
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
  calculatedCost: integer('calculated_cost'), // Stored meeting cost in currency units
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
  reflectionData: jsonb('reflection_data').$type<{
    mood?: string;
    wentWell?: string;
    toImprove?: string;
    tomorrowPriorities?: string;
  } | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('daily_notes_user_date_idx').on(t.userId, t.noteDate),
]);

export const habitFrequency = pgEnum('habit_frequency', ['daily', 'weekly']);

export const habits = pgTable('habits', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  frequency: habitFrequency('frequency').notNull().default('daily'),
  targetDays: jsonb('target_days').$type<number[]>().default([]), // 0=Sunday ... 6=Saturday
  color: text('color').notNull().default('#10b981'),
  icon: text('icon').notNull().default('✓'),
  targetPerPeriod: integer('target_per_period').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('habits_user_idx').on(t.userId),
]);

export const habitEntries = pgTable('habit_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  habitId: uuid('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entryDate: timestamp('entry_date', { withTimezone: true }).notNull(),
  completed: boolean('completed').notNull().default(false),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('habit_entries_habit_date_idx').on(t.habitId, t.entryDate),
  index('habit_entries_user_date_idx').on(t.userId, t.entryDate),
  uniqueIndex('habit_entries_habit_date_unique').on(t.habitId, t.entryDate),
]);

export const taskTemplates = pgTable('task_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultCategoryId: uuid('default_category_id').references(() => categories.id, { onDelete: 'set null' }),
  defaultTitle: text('default_title').notNull(),
  defaultDescription: text('default_description'),
  defaultEstimatedMinutes: integer('default_estimated_minutes').notNull().default(60),
  defaultPriority: integer('default_priority').notNull().default(3),
  defaultStatus: taskStatus('default_status').notNull().default('todo'),
  defaultRecurringRule: jsonb('default_recurring_rule').$type<{
    freq: 'daily' | 'weekly' | 'monthly';
    byDay?: string[];
    interval?: number;
    until?: string;
    defaultTime?: string;
    defaultDurationMinutes?: number;
  } | null>(),
  defaultLabels: jsonb('default_labels').$type<string[]>().default([]),
  defaultSubtasks: jsonb('default_subtasks').$type<Array<{ id: string; title: string; done: boolean }>>().default([]),
  isPinned: boolean('is_pinned').notNull().default(false),
  variables: jsonb('variables').$type<Array<{
    name: string;
    placeholder: string;
    defaultValue?: string;
    type: 'text' | 'number' | 'date' | 'select';
    options?: string[];
  }>>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('task_templates_user_idx').on(t.userId),
]);

export const goalPeriod = pgEnum('goal_period', ['weekly', 'monthly', 'quarterly', 'yearly']);
export const goalStatus = pgEnum('goal_status', ['active', 'completed', 'paused', 'archived']);
export const projectStatus = pgEnum('project_status', ['active', 'completed', 'archived', 'on_hold']);

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: projectStatus('status').notNull().default('active'),
  color: text('color').notNull().default('#6366f1'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('projects_user_status_idx').on(t.userId, t.status),
]);

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  period: goalPeriod('period').notNull().default('quarterly'),
  status: goalStatus('status').notNull().default('active'),
  targetValue: integer('target_value').notNull(), // Numeric target (e.g., 12 books, 1000 sales)
  currentValue: integer('current_value').notNull().default(0), // Current progress
  unit: text('unit'), // Unit label (e.g., "books", "km", "$")
  color: text('color').notNull().default('#3b82f6'),
  category: text('category'), // Optional category for grouping
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  linkedTaskIds: jsonb('linked_task_ids').$type<string[]>().default([]), // Tasks that contribute to this goal
  linkedHabitIds: jsonb('linked_habit_ids').$type<string[]>().default([]), // Habits that contribute to this goal
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('goals_user_status_idx').on(t.userId, t.status),
  index('goals_user_period_idx').on(t.userId, t.period),
]);

export const musicPlaylists = pgTable('music_playlists', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('music_playlists_user_idx').on(t.userId),
]);

export const musicTracks = pgTable('music_tracks', {
  id: uuid('id').defaultRandom().primaryKey(),
  playlistId: uuid('playlist_id').notNull().references(() => musicPlaylists.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  artist: text('artist'),
  album: text('album'),
  duration: integer('duration'), // Duration in seconds
  fileData: text('file_data').notNull(), // Base64 encoded audio data or external URL
  fileType: text('file_type').notNull().default('audio/mp3'), // MIME type
  fileSize: integer('file_size'), // File size in bytes
  order: integer('order').notNull().default(0), // For playlist ordering
  playCount: integer('play_count').notNull().default(0),
  lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('music_tracks_playlist_idx').on(t.playlistId),
  index('music_tracks_user_idx').on(t.userId),
]);

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TimeBlock = typeof timeBlocks.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingEventType = typeof bookingEventTypes.$inferSelect;
export type BookingAvailability = typeof bookingAvailability.$inferSelect;
export type ManagerUser = typeof managerUsers.$inferSelect;
export type DailyNote = typeof dailyNotes.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitEntry = typeof habitEntries.$inferSelect;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type MusicPlaylist = typeof musicPlaylists.$inferSelect;
export type MusicTrack = typeof musicTracks.$inferSelect;

export const taskSessionStatus = pgEnum('task_session_status', ['in_progress', 'completed', 'abandoned']);

export const taskSessions = pgTable('task_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes').notNull(), // Planned duration
  actualMinutes: integer('actual_minutes'), // Actual time spent
  status: taskSessionStatus('status').notNull().default('in_progress'),
  focusPlaylistId: uuid('focus_playlist_id').references(() => musicPlaylists.$inferSelect.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('task_sessions_task_idx').on(t.taskId),
  index('task_sessions_user_idx').on(t.userId),
  index('task_sessions_date_idx').on(t.userId, t.startedAt),
]);

export type TaskSession = typeof taskSessions.$inferSelect;

// Smart scheduling recommendations cache (user-scoped)
export const schedulingRecommendations = pgTable('scheduling_recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  recommendedHour: integer('recommended_hour').notNull(), // Hour of day (0-23)
  confidence: integer('confidence').notNull(), // 0-100 confidence score
  reasoning: text('reasoning').notNull(), // Human-readable explanation
  energyPattern: jsonb('energy_pattern').$type<{
    hour: number;
    avgEnergy: number;
    sampleCount: number;
  }[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('scheduling_rec_user_idx').on(t.userId),
  index('scheduling_rec_task_idx').on(t.taskId),
  index('scheduling_rec_expires_idx').on(t.expiresAt),
]);

export type SchedulingRecommendation = typeof schedulingRecommendations.$inferSelect;
