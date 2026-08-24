import { type VercelRequest, type VercelResponse } from '@vercel/node';
import { eq, and, desc, count, avg, gte, lte, sql } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { users, achievements, userAchievements, tasks, taskSessions, timeBlocks, habitEntries } from '../server/lib/db/schema.js';
import { requireAuth } from '../server/lib/auth-middleware.js';
import type { AuthedRequest } from '../server/lib/auth-middleware.js';

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { action } = req.query;

  try {
    // GET /api/achievements?action=list
    if (req.method === 'GET' && action === 'list') {
      const allAchievements = await db.query.achievements.findMany();
      const userUnlocked = await db.query.userAchievements.findMany({
        where: eq(userAchievements.userId, user.sub),
      });

      const unlockedIds = new Set(userUnlocked.map(ua => ua.achievementId));
      const achievementsWithStatus = allAchievements.map(a => ({
        ...a,
        isUnlocked: unlockedIds.has(a.id),
        progress: userUnlocked.find(ua => ua.achievementId === a.id)?.progress || null,
        unlockedAt: userUnlocked.find(ua => ua.achievementId === a.id)?.unlockedAt || null,
      }));

      res.json(achievementsWithStatus);
      return;
    }

    // POST /api/achievements?action=check
    if (req.method === 'POST' && action === 'check') {
      const unlocked = await checkAndUnlockAchievements(user.sub);
      res.json({ unlocked });
      return;
    }

    // GET /api/achievements?action=progress
    if (req.method === 'GET' && action === 'progress') {
      const allAchievements = await db.query.achievements.findMany();
      const userProgress = await calculateAllProgress(user.sub, allAchievements);
      res.json(userProgress);
      return;
    }

    // GET /api/achievements?action=stats
    if (req.method === 'GET' && action === 'stats') {
      const userUnlocked = await db.query.userAchievements.findMany({
        where: eq(userAchievements.userId, user.sub),
      });

      const totalPoints = await db
        .select({ total: sql<number>`sum(${achievements.points})` })
        .from(achievements)
        .innerJoin(userAchievements, eq(userAchievements.achievementId, achievements.id))
        .where(eq(userAchievements.userId, user.sub));

      const recent = await db.query.userAchievements.findMany({
        where: eq(userAchievements.userId, user.sub),
        with: {
          achievement: true,
        },
        orderBy: [desc(userAchievements.unlockedAt)],
        limit: 5,
      });

      res.json({
        totalUnlocked: userUnlocked.length,
        totalPoints: totalPoints[0]?.total || 0,
        recent: recent.map(ua => ua.achievement ? {
          ...ua.achievement,
          unlockedAt: ua.unlockedAt,
        } : null),
      });
      return;
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Achievements API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to check and unlock achievements
async function checkAndUnlockAchievements(userId: string) {
  const allAchievements = await db.query.achievements.findMany();
  const existingUnlocks = await db.query.userAchievements.findMany({
    where: eq(userAchievements.userId, userId),
  });
  const unlockedIds = new Set(existingUnlocks.map(ua => ua.achievementId));

  const newlyUnlocked = [];

  for (const achievement of allAchievements) {
    if (unlockedIds.has(achievement.id)) continue;

    const { current, target } = await calculateProgress(userId, achievement);
    const isUnlocked = current >= target;

    if (isUnlocked) {
      await db.insert(userAchievements).values({
        userId,
        achievementId: achievement.id,
        progress: { current, target, lastUpdated: new Date().toISOString() },
      });
      newlyUnlocked.push(achievement);
    } else {
      // Update progress for existing or create placeholder
      const existing = existingUnlocks.find(ua => ua.achievementId === achievement.id);
      if (existing) {
        await db.update(userAchievements)
          .set({ progress: { current, target, lastUpdated: new Date().toISOString() } })
          .where(eq(userAchievements.id, existing.id));
      }
    }
  }

  return newlyUnlocked;
}

// Calculate progress for a single achievement
async function calculateProgress(userId: string, achievement: any) {
  const { type, field, target, period } = achievement.requirement;
  let current = 0;

  const now = new Date();
  let fromDate = new Date(0);

  if (period === 'day') {
    fromDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (period === 'week') {
    fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 7);
  } else if (period === 'month') {
    fromDate = new Date(now);
    fromDate.setMonth(fromDate.getMonth() - 1);
  } else if (period === 'ever') {
    fromDate = new Date(0);
  }

  switch (field) {
    case 'completedTasks':
      const completedTasks = await db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.status, 'done'),
            period === 'ever' ? undefined : gte(tasks.updatedAt, fromDate)
          )
        );
      current = completedTasks[0]?.count || 0;
      break;

    case 'completedSessions':
      const sessions = await db
        .select({ count: count() })
        .from(taskSessions)
        .where(
          and(
            eq(taskSessions.userId, userId),
            eq(taskSessions.status, 'completed'),
            period === 'ever' ? undefined : gte(taskSessions.completedAt, fromDate)
          )
        );
      current = sessions[0]?.count || 0;
      break;

    case 'totalFocusMinutes':
      const totalMinutes = await db
        .select({ total: sql<number>`sum(${taskSessions.actualMinutes})` })
        .from(taskSessions)
        .where(
          and(
            eq(taskSessions.userId, userId),
            eq(taskSessions.status, 'completed'),
            period === 'ever' ? undefined : gte(taskSessions.completedAt, fromDate)
          )
        );
      current = Math.floor((totalMinutes[0]?.total || 0) / 60); // Convert to hours
      break;

    case 'highPriorityTasks':
      const highPriority = await db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.status, 'done'),
            lte(tasks.priority, 2),
            period === 'ever' ? undefined : gte(tasks.updatedAt, fromDate)
          )
        );
      current = highPriority[0]?.count || 0;
      break;

    case 'dailyStreak':
      // Calculate consecutive days with at least one completed task
      const taskDays = await db
        .select({ date: sql<string>`date(${tasks.updatedAt})` })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.status, 'done'),
            gte(tasks.updatedAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) // Last year
          )
        )
        .orderBy(sql`date(${tasks.updatedAt}) DESC`);

      const uniqueDays = [...new Set(taskDays.map(t => t.date))];
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < uniqueDays.length; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];

        if (uniqueDays.includes(dateStr)) {
          streak++;
        } else {
          break;
        }
      }
      current = streak;
      break;

    case 'estimationAccuracy':
      // Calculate average estimation accuracy
      const accuracyData = await db
        .select({
          planned: taskSessions.durationMinutes,
          actual: taskSessions.actualMinutes,
        })
        .from(taskSessions)
        .where(
          and(
            eq(taskSessions.userId, userId),
            eq(taskSessions.status, 'completed'),
            period === 'ever' ? undefined : gte(taskSessions.completedAt, fromDate)
          )
        );

      if (accuracyData.length > 0) {
        const accuracies = accuracyData.map(d => {
          if (!d.actual || d.actual === 0) return 0;
          const ratio = Math.min(d.planned / d.actual, d.actual / d.planned);
          return Math.round(ratio * 100);
        });
        current = Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length);
      }
      break;

    case 'weeklyCompletion':
      // Check if all 7 days of current week have completed tasks
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekTasks = await db
        .select({ date: sql<string>`date(${tasks.updatedAt})` })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.status, 'done'),
            gte(tasks.updatedAt, weekStart)
          )
        );

      const uniqueWeekDays = new Set(weekTasks.map(t => t.date));
      current = uniqueWeekDays.size;
      break;

    case 'habitsCompleted':
      const habitCount = await db
        .select({ count: count() })
        .from(habitEntries)
        .where(
          and(
            eq(habitEntries.userId, userId),
            eq(habitEntries.completed, true),
            period === 'ever' ? undefined : gte(habitEntries.entryDate, fromDate)
          )
        );
      current = habitCount[0]?.count || 0;
      break;
  }

  return { current, target };
}

// Calculate progress for all achievements
async function calculateAllProgress(userId: string, allAchievements: any[]) {
  const progress = [];

  for (const achievement of allAchievements) {
    const { current, target } = await calculateProgress(userId, achievement);
    progress.push({
      achievementId: achievement.id,
      slug: achievement.slug,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      color: achievement.color,
      category: achievement.category,
      points: achievement.points,
      isSecret: achievement.isSecret,
      progress: { current, target, percentage: Math.min(100, Math.round((current / target) * 100)) },
    });
  }

  return progress;
}