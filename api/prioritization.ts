import type { VercelResponse } from '@vercel/node';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { tasks, timeBlocks, users } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

interface PriorityScore {
  taskId: string;
  title: string;
  score: number;
  factors: {
    urgency: number;      // 0-100 based on due date
    importance: number;   // 0-100 based on priority level
    dependencies: number; // 0-100 based on blocking tasks
    effort: number;       // 0-100 based on estimated time vs available
    age: number;          // 0-100 based on creation date
    energy: number;       // 0-100 based on energy patterns
  };
  reasoning: string[];
}

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res);
  if (!me) return;

  try {
    // Get user's timezone and settings
    const userRows = await db.select({
      timezone: users.timezone,
      materializedUntil: users.materializedUntil,
    }).from(users).where(eq(users.id, me.sub)).limit(1);

    const user = userRows[0] || { timezone: 'Asia/Bangkok' };

    // Get active tasks (not backlog, archived, or done)
    const taskRows = await db.select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      estimatedMinutes: tasks.estimatedMinutes,
      blockedByTaskIds: tasks.blockedByTaskIds,
      createdAt: tasks.createdAt,
      categoryId: tasks.categoryId,
    }).from(tasks).where(and(
      eq(tasks.userId, me.sub),
      or(
        eq(tasks.status, 'todo'),
        eq(tasks.status, 'doing')
      )
    ));

    // Get today's time blocks for capacity calculation
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayBlocks = await db.select({
      startAt: timeBlocks.startAt,
      endAt: timeBlocks.endAt,
      status: timeBlocks.status,
    }).from(timeBlocks).where(and(
      eq(timeBlocks.userId, me.sub),
      eq(timeBlocks.status, 'planned'),
      // @ts-ignore
      gte(timeBlocks.startAt, todayStart),
      // @ts-ignore
      lte(timeBlocks.startAt, todayEnd)
    ));

    // Calculate remaining capacity today
    const workDayMinutes = 8 * 60; // 8 hour workday
    const bookedMinutes = todayBlocks.reduce((sum, block) => {
      const duration = (new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / (1000 * 60);
      return sum + duration;
    }, 0);
    const remainingMinutes = Math.max(0, workDayMinutes - bookedMinutes);

    // Score each task
    const scoredTasks: PriorityScore[] = [];
    const taskMap = new Map(taskRows.map(t => [t.id, t]));

    for (const task of taskRows) {
      const factors = {
        urgency: calculateUrgency(task.dueDate, user.timezone),
        importance: calculateImportance(task.priority),
        dependencies: calculateDependencies(task.blockedByTaskIds || [], taskMap),
        effort: calculateEffortFit(task.estimatedMinutes, remainingMinutes),
        age: calculateAge(task.createdAt),
        energy: 50, // Placeholder - could integrate with energy patterns later
      };

      // Weighted score (adjust weights as needed)
      const score =
        (factors.urgency * 0.30) +
        (factors.importance * 0.25) +
        (factors.dependencies * 0.20) +
        (factors.effort * 0.10) +
        (factors.age * 0.10) +
        (factors.energy * 0.05);

      const reasoning = generateReasoning(task, factors);

      scoredTasks.push({
        taskId: task.id,
        title: task.title,
        score: Math.round(score),
        factors,
        reasoning,
      });
    }

    // Sort by score and return top 5
    scoredTasks.sort((a, b) => b.score - a.score);
    const topTasks = scoredTasks.slice(0, 5);

    return res.status(200).json({
      tasks: topTasks,
      meta: {
        totalActive: taskRows.length,
        remainingMinutes,
        workDayMinutes,
      }
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

function calculateUrgency(dueDate: Date | null, timezone: string): number {
  if (!dueDate) return 30; // Base urgency for tasks without due dates

  const now = new Date();
  const due = new Date(dueDate);
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return 100; // Overdue
  if (daysUntilDue === 0) return 95;  // Due today
  if (daysUntilDue === 1) return 85;  // Due tomorrow
  if (daysUntilDue <= 2) return 70;  // Due within 2 days
  if (daysUntilDue <= 7) return 50;  // Due within a week
  return 30; // Not urgent
}

function calculateImportance(priority: number): number {
  // Priority in schema is 1-5 (1=high, 5=low) - convert to importance score
  const normalizedPriority = Math.max(1, Math.min(5, priority));
  return (6 - normalizedPriority) * 20; // 1→100, 2→80, 3→60, 4→40, 5→20
}

function calculateDependencies(blockedByIds: string[], taskMap: Map<string, any>): number {
  if (blockedByIds.length === 0) return 0; // Not blocked

  // Check if blocking tasks are completed
  let completedBlockers = 0;
  for (const blockerId of blockedByIds) {
    const blocker = taskMap.get(blockerId);
    if (blocker && blocker.status === 'done') {
      completedBlockers++;
    }
  }

  const blockerProgress = blockedByIds.length > 0
    ? completedBlockers / blockedByIds.length
    : 0;

  // Higher score if most blockers are complete (task becomes actionable)
  return blockerProgress * 100;
}

function calculateEffortFit(estimatedMinutes: number, remainingMinutes: number): number {
  if (remainingMinutes <= 0) return 20; // No capacity today

  // Higher score if task fits well in remaining time
  const ratio = estimatedMinutes / remainingMinutes;

  if (ratio <= 0.25) return 90;  // Quick win - fits easily
  if (ratio <= 0.5) return 80;    // Good fit
  if (ratio <= 0.75) return 60;  // Manageable
  if (ratio <= 1.0) return 40;    // Tight fit
  return 20;                      // Too long for remaining time
}

function calculateAge(createdAt: Date): number {
  const now = new Date();
  const created = new Date(createdAt);
  const daysOld = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  if (daysOld > 30) return 100;   // Very old task
  if (daysOld > 14) return 75;    // Old task
  if (daysOld > 7) return 50;     // Week old
  if (daysOld > 3) return 25;     // Few days old
  return 10;                       // Recent task
}

function generateReasoning(task: any, factors: any): string[] {
  const reasons: string[] = [];

  // Urgency reasons
  if (factors.urgency >= 90) {
    if (task.dueDate) {
      const daysUntilDue = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue < 0) reasons.push('⚠️ Overdue - needs immediate attention');
      else if (daysUntilDue === 0) reasons.push('🔴 Due today - time sensitive');
      else reasons.push('🟠 Due soon - plan accordingly');
    }
  }

  // Importance reasons
  if (factors.importance >= 80) {
    reasons.push('⭐ High priority - aligned with your goals');
  } else if (factors.importance <= 40) {
    reasons.push('💭 Lower priority - consider if this is the best use of time');
  }

  // Dependency reasons
  if (factors.dependencies >= 75) {
    reasons.push('✅ Most blockers completed - ready to focus on');
  } else if (factors.dependencies > 0 && factors.dependencies < 50) {
    reasons.push('⏳ Still blocked by other tasks - may need to wait');
  }

  // Effit reasons
  if (factors.effort >= 80) {
    reasons.push('⚡ Quick win - fits perfectly in your schedule');
  } else if (factors.effort <= 30) {
    reasons.push('⏰ Large time commitment - consider breaking down');
  }

  // Age reasons
  if (factors.age >= 75) {
    reasons.push('📅 Long-standing task - time to move forward or archive');
  }

  return reasons.length > 0 ? reasons : ['📝 Standard priority - no special factors'];
}