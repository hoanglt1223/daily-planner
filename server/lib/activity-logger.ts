import { db } from './db/client.js';
import { activityLog } from './db/schema.js';
import type { ActivityLog } from './db/schema.js';
import { lt } from 'drizzle-orm';

export type ActivityAction =
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_deleted'
  | 'task_reassigned'
  | 'booking_created'
  | 'booking_approved'
  | 'booking_rejected'
  | 'booking_cancelled'
  | 'achievement_unlocked'
  | 'achievement_progress'
  | 'user_role_changed'
  | 'user_joined'
  | 'time_block_created'
  | 'time_block_updated'
  | 'time_block_completed'
  | 'goal_created'
  | 'goal_updated'
  | 'goal_completed'
  | 'habit_completed'
  | 'comment_added';

export type EntityType =
  | 'task'
  | 'booking'
  | 'achievement'
  | 'user'
  | 'time_block'
  | 'goal'
  | 'habit'
  | 'comment';

export interface ActivityMetadata {
  title?: string;
  priority?: number;
  assignee?: string;
  status?: string;
  [key: string]: any;
}

/**
 * Record an activity in the activity log
 * @param userId - User who performed the action
 * @param action - Type of action performed
 * @param entityType - Type of entity affected
 * @param entityId - ID of entity affected
 * @param metadata - Additional context about the action
 */
export async function recordActivity(
  userId: string,
  action: ActivityAction,
  entityType: EntityType,
  entityId: string,
  metadata: ActivityMetadata = {}
): Promise<ActivityLog | null> {
  try {
    const [activity] = await db
      .insert(activityLog)
      .values({
        userId,
        action,
        entityType,
        entityId,
        metadata,
      })
      .returning();

    return activity || null;
  } catch (error) {
    console.error('Failed to record activity:', error);
    return null;
  }
}

/**
 * Record task-related activities
 */
export async function recordTaskActivity(
  userId: string,
  action: 'task_created' | 'task_updated' | 'task_completed' | 'task_deleted' | 'task_reassigned',
  taskId: string,
  metadata: {
    title: string;
    priority?: number;
    assignee?: string;
    status?: string;
    [key: string]: any;
  }
) {
  return recordActivity(userId, action, 'task', taskId, metadata);
}

/**
 * Record booking-related activities
 */
export async function recordBookingActivity(
  userId: string,
  action: 'booking_created' | 'booking_approved' | 'booking_rejected' | 'booking_cancelled',
  bookingId: string,
  metadata: {
    title: string;
    visitorName?: string;
    [key: string]: any;
  }
) {
  return recordActivity(userId, action, 'booking', bookingId, metadata);
}

/**
 * Record achievement-related activities
 */
export async function recordAchievementActivity(
  userId: string,
  action: 'achievement_unlocked' | 'achievement_progress',
  achievementId: string,
  metadata: {
    title: string;
    points?: number;
    progress?: number;
    [key: string]: any;
  }
) {
  return recordActivity(userId, action, 'achievement', achievementId, metadata);
}

/**
 * Record time block activities
 */
export async function recordTimeBlockActivity(
  userId: string,
  action: 'time_block_created' | 'time_block_updated' | 'time_block_completed',
  blockId: string,
  metadata: {
    title: string;
    startAt: string;
    endAt: string;
    [key: string]: any;
  }
) {
  return recordActivity(userId, action, 'time_block', blockId, metadata);
}

/**
 * Cleanup old activity logs (older than 90 days)
 * This should be run periodically to prevent table bloat
 */
export async function cleanupOldActivities(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  try {
    const result = await db
      .delete(activityLog)
      .where(lt(activityLog.createdAt, cutoffDate));

    return result.rowCount || 0;
  } catch (error) {
    console.error('Failed to cleanup old activities:', error);
    return 0;
  }
}