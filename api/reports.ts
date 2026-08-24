import type { VercelResponse } from '@vercel/node';
import { and, eq, gte, inArray, lte, count, desc, or } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { bookings, bookingEventTypes, goals, habitEntries, habits, managerUsers, schedulingRecommendations, tasks, timeBlocks, users, activityLog } from '../server/lib/db/schema.js';
import { requireAuth, type AuthedRequest } from '../server/lib/auth-middleware.js';

// Capacity baseline: 8 work-hours per day, matching WORKDAY_HOURS in src/lib/time-utils.ts
const WORKDAY_MINUTES = 8 * 60;

export default async function handler(req: AuthedRequest, res: VercelResponse) {
  const me = requireAuth(req, res);
  if (!me) return;
  const kind = String(req.query.kind || 'summary');

  try {
    const from = req.query.from ? new Date(String(req.query.from)) : startOfWeek();
    const to = req.query.to ? new Date(String(req.query.to)) : endOfWeek();

    if (kind === 'team-capacity') {
      return handleTeamCapacity(req, res, me, from, to);
    }

    const rows = await db.select().from(timeBlocks).where(and(
      eq(timeBlocks.userId, me.sub),
      gte(timeBlocks.startAt, from),
      lte(timeBlocks.startAt, to),
    ));

    if (kind === 'capacity') {
      const totalMinutes = rows.reduce((s, r) =>
        s + Math.round((r.endAt.getTime() - r.startAt.getTime()) / 60000), 0);
      return res.status(200).json({ from, to, totalMinutes, blocks: rows.length });
    }

    if (kind === 'summary' || kind === 'timesheet') {
      const byDay: Record<string, number> = {};
      for (const r of rows) {
        const key = r.startAt.toISOString().slice(0, 10);
        byDay[key] = (byDay[key] || 0) +
          Math.round((r.endAt.getTime() - r.startAt.getTime()) / 60000);
      }
      return res.status(200).json({ from, to, byDay, blocks: rows });
    }

    if (kind === 'estimation-accuracy') {
      return await handleEstimationAccuracy(req, res, me, from, to);
    }

    if (kind === 'activities') {
      return await handleActivities(req, res, me, from, to);
    }

    if (kind === 'weekly-review') {
      return await handleWeeklyReview(req, res, me, from, to);
    }

    if (kind === 'insights') {
      return await handleInsights(req, res, me, from, to);
    }

    if (kind === 'energy-patterns') {
      return await handleEnergyPatterns(req, res, me, from, to);
    }

    if (kind === 'completion-rates') {
      return await handleCompletionRates(req, res, me);
    }

    if (kind === 'meeting-costs') {
      return await handleMeetingCosts(req, res, me, from, to);
    }

    if (kind === 'smart-schedule') {
      return await handleSmartSchedule(req, res, me);
    }

    if (kind === 'burnout-risk') {
      return await handleBurnoutRisk(req, res, me, from, to);
    }

    return res.status(404).json({ error: 'unknown_kind' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ── Team-capacity handler ──────────────────────────────────────────────────────

export type TeamCapacityDay = {
  date: string; // yyyy-MM-dd UTC
  bookedMinutes: number;
  freeMinutes: number;
};

export type TeamCapacityUser = {
  userId: string;
  name: string;
  email: string;
  privacy: string;
  days: TeamCapacityDay[];
};

export type TeamCapacityResponse = {
  from: string;
  to: string;
  workdayMinutes: number;
  users: TeamCapacityUser[];
};

export type EstimationAccuracyTask = {
  taskId: string;
  taskTitle: string;
  estimatedMinutes: number;
  actualMinutes: number;
  accuracyPercent: number;
  varianceMinutes: number;
  completedAt: string;
};

export type EstimationAccuracyResponse = {
  from: string;
  to: string;
  overall: {
    totalTasks: number;
    avgAccuracyPercent: number;
    totalEstimatedMinutes: number;
    totalActualMinutes: number;
    overestimatedTasks: number;
    underestimatedTasks: number;
    accurateTasks: number;
  };
  tasks: EstimationAccuracyTask[];
  insights: string[];
};

async function handleTeamCapacity(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string; role: string },
  from: Date,
  to: Date,
) {
  // Only managers and admins may access team capacity
  if (me.role !== 'manager' && me.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }

  // Fetch mapped users (admin sees all, manager sees mapped)
  let mappedUsers: Array<{ id: string; name: string; email: string; privacy: string }>;
  if (me.role === 'admin') {
    mappedUsers = await db.select({
      id: users.id, name: users.name, email: users.email, privacy: users.privacy,
    }).from(users);
  } else {
    mappedUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, privacy: users.privacy })
      .from(managerUsers)
      .innerJoin(users, eq(users.id, managerUsers.userId))
      .where(eq(managerUsers.managerId, me.sub));
  }

  if (mappedUsers.length === 0) {
    return res.status(200).json({
      from: from.toISOString(),
      to: to.toISOString(),
      workdayMinutes: WORKDAY_MINUTES,
      users: [],
    } satisfies TeamCapacityResponse);
  }

  // Identify which users expose busy details vs aggregate only
  // Privacy semantics (mirrored from api/time-blocks.ts canViewUser):
  //   details_to_managers -> full block data visible; booked minutes accurate
  //   busy_only_to_managers -> blocks redacted to "Busy"; booked minutes still accurate
  //   private -> 403 for non-admin/non-self; for admin show aggregate, for manager exclude
  const visibleUserIds: string[] = [];
  const privateUserIds = new Set<string>();

  for (const u of mappedUsers) {
    if (u.privacy === 'private' && me.role !== 'admin') {
      privateUserIds.add(u.id);
    } else {
      visibleUserIds.push(u.id);
    }
  }

  // Single batched query for all visible users in the date range
  let allBlocks: Array<{
    userId: string;
    startAt: Date;
    endAt: Date;
  }> = [];

  if (visibleUserIds.length > 0) {
    allBlocks = await db.select({
      userId: timeBlocks.userId,
      startAt: timeBlocks.startAt,
      endAt: timeBlocks.endAt,
    }).from(timeBlocks).where(and(
      inArray(timeBlocks.userId, visibleUserIds),
      gte(timeBlocks.startAt, from),
      lte(timeBlocks.startAt, to),
    ));
  }

  // Build per-user per-day buckets
  const blocksByUser = new Map<string, typeof allBlocks>();
  for (const b of allBlocks) {
    const existing = blocksByUser.get(b.userId) ?? [];
    existing.push(b);
    blocksByUser.set(b.userId, existing);
  }

  // Build day keys for the window (yyyy-MM-dd UTC)
  const dayKeys = buildDayKeys(from, to);

  const result: TeamCapacityUser[] = [];

  for (const u of mappedUsers) {
    // Private users are excluded for managers; admin sees them with zero busy (respects privacy)
    if (privateUserIds.has(u.id)) {
      if (me.role === 'admin') {
        // Admin can still see the user in the grid but with no block detail
        result.push({
          userId: u.id,
          name: u.name,
          email: u.email,
          privacy: u.privacy,
          days: dayKeys.map(date => ({
            date,
            bookedMinutes: 0,
            freeMinutes: WORKDAY_MINUTES,
          })),
        });
      }
      // For manager: skip private users entirely
      continue;
    }

    const userBlocks = blocksByUser.get(u.id) ?? [];

    // Aggregate booked minutes per day
    const bookedByDay = new Map<string, number>();
    for (const b of userBlocks) {
      const key = b.startAt.toISOString().slice(0, 10);
      const mins = Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60_000);
      bookedByDay.set(key, (bookedByDay.get(key) ?? 0) + mins);
    }

    const days: TeamCapacityDay[] = dayKeys.map(date => {
      const booked = bookedByDay.get(date) ?? 0;
      const capped = Math.min(booked, WORKDAY_MINUTES);
      return {
        date,
        bookedMinutes: capped,
        freeMinutes: Math.max(0, WORKDAY_MINUTES - capped),
      };
    });

    result.push({
      userId: u.id,
      name: u.name,
      email: u.email,
      privacy: u.privacy,
      days,
    });
  }

  return res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    workdayMinutes: WORKDAY_MINUTES,
    users: result,
  } satisfies TeamCapacityResponse);
}

export type WeeklyReviewResponse = {
  from: string;
  to: string;
  timeSummary: {
    totalPlannedMinutes: number;
    totalActualMinutes: number;
    totalCompletedMinutes: number;
    utilizationPercent: number;
    completionRate: number;
    daysWorked: number;
  };
  taskSummary: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    backlogTasks: number;
    highPriorityCompleted: number;
  };
  habitSummary: {
    totalHabits: number;
    activeHabits: number;
    totalEntries: number;
    completedEntries: number;
    streakData: Array<{ habitId: string; habitName: string; currentStreak: number }>;
  };
  goalProgress: Array<{
    goalId: string;
    title: string;
    targetValue: number;
    currentValue: number;
    progressPercent: number;
    status: string;
  }>;
  topTasks: Array<{
    taskId: string;
    title: string;
    status: string;
    priority: number;
    completedAt?: string;
  }>;
  insights: string[];
};

// ── Estimation Accuracy handler ─────────────────────────────────────────────────

async function handleEstimationAccuracy(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string },
  from: Date,
  to: Date,
) {
  // Fetch completed tasks with time blocks in the date range
  const taskData = await db
    .select({
      taskId: tasks.id,
      taskTitle: tasks.title,
      estimatedMinutes: tasks.estimatedMinutes,
      actualMinutes: timeBlocks.actualMinutes,
      blockStartAt: timeBlocks.startAt,
    })
    .from(tasks)
    .innerJoin(timeBlocks, eq(timeBlocks.taskId, tasks.id))
    .where(and(
      eq(tasks.userId, me.sub),
      eq(timeBlocks.status, 'completed'),
      gte(timeBlocks.startAt, from),
      lte(timeBlocks.startAt, to),
    ))
    .orderBy(timeBlocks.startAt);

  if (taskData.length === 0) {
    return res.status(200).json({
      from: from.toISOString(),
      to: to.toISOString(),
      overall: {
        totalTasks: 0,
        avgAccuracyPercent: 0,
        totalEstimatedMinutes: 0,
        totalActualMinutes: 0,
        overestimatedTasks: 0,
        underestimatedTasks: 0,
        accurateTasks: 0,
      },
      tasks: [],
      insights: ['No completed tasks found in this date range.'],
    } satisfies EstimationAccuracyResponse);
  }

  // Calculate per-task accuracy
  const accuracyTasks: EstimationAccuracyTask[] = [];
  let totalEstimated = 0;
  let totalActual = 0;
  let overestimated = 0;
  let underestimated = 0;
  let accurate = 0;

  for (const task of taskData) {
    if (!task.actualMinutes || task.actualMinutes <= 0) continue;

    const estimated = task.estimatedMinutes || 60;
    const actual = task.actualMinutes;
    const variance = actual - estimated;
    const accuracyPercent = Math.max(0, 100 - Math.abs(variance) / estimated * 100);

    totalEstimated += estimated;
    totalActual += actual;

    if (variance > 0) overestimated++;
    else if (variance < 0) underestimated++;
    else accurate++;

    accuracyTasks.push({
      taskId: task.taskId,
      taskTitle: task.taskTitle,
      estimatedMinutes: estimated,
      actualMinutes: actual,
      accuracyPercent: Math.round(accuracyPercent),
      varianceMinutes: variance,
      completedAt: task.blockStartAt.toISOString(),
    });
  }

  const avgAccuracy = accuracyTasks.length > 0
    ? accuracyTasks.reduce((sum, t) => sum + t.accuracyPercent, 0) / accuracyTasks.length
    : 0;

  // Generate insights
  const insights: string[] = [];
  if (avgAccuracy < 60) {
    insights.push('Your time estimations need improvement. Consider adding buffer time.');
  } else if (avgAccuracy < 80) {
    insights.push('Your estimations are fairly accurate but could be more consistent.');
  } else {
    insights.push('Great job! Your time estimations are quite accurate.');
  }

  if (underestimated > overestimated) {
    insights.push('You tend to underestimate tasks. Try multiplying your estimates by 1.5x.');
  } else if (overestimated > underestimated) {
    insights.push('You tend to overestimate tasks. This is good for buffer management, but may affect planning.');
  }

  const varianceFromAvg = totalActual - totalEstimated;
  if (varianceFromAvg > 0) {
    insights.push(`Overall, you spent ${Math.round(varianceFromAvg / 60 * 10) / 10}h more than estimated in this period.`);
  } else if (varianceFromAvg < 0) {
    insights.push(`Overall, you spent ${Math.round(Math.abs(varianceFromAvg) / 60 * 10) / 10}h less than estimated in this period.`);
  }

  return res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    overall: {
      totalTasks: accuracyTasks.length,
      avgAccuracyPercent: Math.round(avgAccuracy),
      totalEstimatedMinutes: totalEstimated,
      totalActualMinutes: totalActual,
      overestimatedTasks: overestimated,
      underestimatedTasks: underestimated,
      accurateTasks: accurate,
    },
    tasks: accuracyTasks,
    insights,
  } satisfies EstimationAccuracyResponse);
}

// ── Weekly Review handler ───────────────────────────────────────────────────────

async function handleWeeklyReview(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string },
  from: Date,
  to: Date,
) {
  // Fetch time blocks for the period
  const blocks = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, me.sub),
    gte(timeBlocks.startAt, from),
    lte(timeBlocks.startAt, to),
  ));

  // Fetch tasks for the period
  const allTasks = await db.select().from(tasks).where(eq(tasks.userId, me.sub));

  // Fetch habit entries for the period
  const habitEntriesData = await db.select().from(habitEntries).where(and(
    eq(habitEntries.userId, me.sub),
    gte(habitEntries.entryDate, from),
    lte(habitEntries.entryDate, to),
  ));

  // Fetch user's habits
  const userHabits = await db.select().from(habits).where(eq(habits.userId, me.sub));

  // Fetch active goals
  const activeGoals = await db.select().from(goals).where(and(
    eq(goals.userId, me.sub),
    eq(goals.status, 'active'),
  ));

  // Calculate time summary
  const totalPlannedMinutes = blocks.reduce((sum, b) =>
    sum + Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000), 0);

  const totalActualMinutes = blocks
    .filter(b => b.actualMinutes && b.actualMinutes > 0)
    .reduce((sum, b) => sum + (b.actualMinutes || 0), 0);

  const totalCompletedMinutes = blocks
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000), 0);

  const uniqueDays = new Set(blocks.map(b => b.startAt.toISOString().slice(0, 10)));
  const daysWorked = uniqueDays.size;

  const workdayCapacity = daysWorked * WORKDAY_MINUTES;
  const utilizationPercent = workdayCapacity > 0 ? Math.round((totalCompletedMinutes / workdayCapacity) * 100) : 0;
  const completionRate = blocks.length > 0 ? Math.round((blocks.filter(b => b.status === 'completed').length / blocks.length) * 100) : 0;

  // Calculate task summary
  const taskSummary = {
    totalTasks: allTasks.length,
    completedTasks: allTasks.filter(t => t.status === 'done').length,
    inProgressTasks: allTasks.filter(t => t.status === 'doing').length,
    backlogTasks: allTasks.filter(t => t.status === 'backlog' || t.status === 'todo').length,
    highPriorityCompleted: allTasks.filter(t => t.status === 'done' && t.priority <= 2).length,
  };

  // Calculate habit summary
  const activeHabits = userHabits.filter(h => h.frequency === 'daily' ||
    (h.frequency === 'weekly' && h.targetDays && h.targetDays.length > 0));

  const habitSummary = {
    totalHabits: userHabits.length,
    activeHabits: activeHabits.length,
    totalEntries: habitEntriesData.length,
    completedEntries: habitEntriesData.filter(e => e.completed).length,
    streakData: [], // Could be enhanced with actual streak calculation
  };

  // Calculate goal progress
  const goalProgress = activeGoals.map(g => ({
    goalId: g.id,
    title: g.title,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
    progressPercent: g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : 0,
    status: g.status,
  }));

  // Get top tasks (recently completed or high priority)
  const topTasks = allTasks
    .filter(t => t.status === 'done' || t.status === 'doing' || t.priority <= 2)
    .slice(0, 10)
    .map(t => ({
      taskId: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      completedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : undefined,
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);

  // Generate insights
  const insights: string[] = [];

  if (utilizationPercent < 50) {
    insights.push('Your work utilization was low this week. Consider planning more focused work time.');
  } else if (utilizationPercent > 90) {
    insights.push('You operated at high capacity this week. Ensure you\'re maintaining balance.');
  }

  if (completionRate < 70) {
    insights.push('Many planned blocks weren\'t completed. Review your planning and consider more realistic estimates.');
  } else if (completionRate >= 90) {
    insights.push('Excellent completion rate! You\'re following through on planned commitments.');
  }

  if (taskSummary.highPriorityCompleted > 0) {
    insights.push(`Great progress on ${taskSummary.highPriorityCompleted} high-priority tasks.`);
  }

  if (habitSummary.totalEntries > 0) {
    const habitCompletionRate = Math.round((habitSummary.completedEntries / habitSummary.totalEntries) * 100);
    if (habitCompletionRate >= 80) {
      insights.push(`Strong habit consistency at ${habitCompletionRate}% completion.`);
    } else if (habitCompletionRate < 50) {
      insights.push('Habit consistency was low. Focus on small wins to build momentum.');
    }
  }

  if (goalProgress.length > 0) {
    const goalsOnTrack = goalProgress.filter(g => g.progressPercent >= 50).length;
    if (goalsOnTrack === goalProgress.length) {
      insights.push('All goals are making solid progress!');
    } else {
      insights.push(`${goalsOnTrack}/${goalProgress.length} goals are on track. Review goal alignment.`);
    }
  }

  if (totalActualMinutes > totalPlannedMinutes) {
    const overtime = Math.round((totalActualMinutes - totalPlannedMinutes) / 60);
    insights.push(`You worked ${overtime}h more than planned. Review your estimation accuracy.`);
  }

  return res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    timeSummary: {
      totalPlannedMinutes,
      totalActualMinutes,
      totalCompletedMinutes,
      utilizationPercent,
      completionRate,
      daysWorked,
    },
    taskSummary,
    habitSummary,
    goalProgress,
    topTasks,
    insights,
  } satisfies WeeklyReviewResponse);
}

// ── Insights handlers ───────────────────────────────────────────────────────────

export type InsightsResponse = {
  from: string;
  to: string;
  productivityScore: number;
  peakHours: Array<{ hour: number; productivity: number; taskCount: number }>;
  completionTrends: Array<{ date: string; completionRate: number; taskCount: number }>;
  recommendations: string[];
};

async function handleInsights(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string },
  from: Date,
  to: Date,
) {
  // Fetch all time blocks for the period
  const blocks = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, me.sub),
    gte(timeBlocks.startAt, from),
    lte(timeBlocks.startAt, to),
  ));

  // Fetch tasks for completion analysis
  const userTasks = await db.select().from(tasks).where(eq(tasks.userId, me.sub));

  // Calculate peak hours (hour of day 0-23)
  const hourlyStats = new Map<number, { completed: number; total: number; energySum: number }>();

  for (const block of blocks) {
    const hour = block.startAt.getUTCHours();
    const existing = hourlyStats.get(hour) || { completed: 0, total: 0, energySum: 0 };

    existing.total++;
    if (block.status === 'completed') existing.completed++;
    if (block.energyLevel) existing.energySum += block.energyLevel;

    hourlyStats.set(hour, existing);
  }

  // Convert to peak hours array with productivity score
  const peakHours = Array.from(hourlyStats.entries())
    .map(([hour, stats]) => ({
      hour,
      productivity: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      taskCount: stats.total,
    }))
    .filter(h => h.taskCount >= 3) // Only hours with meaningful data
    .sort((a, b) => b.productivity - a.productivity)
    .slice(0, 8);

  // Calculate completion trends by day
  const dailyStats = new Map<string, { completed: number; total: number }>();

  for (const block of blocks) {
    const date = block.startAt.toISOString().slice(0, 10);
    const existing = dailyStats.get(date) || { completed: 0, total: 0 };

    existing.total++;
    if (block.status === 'completed') existing.completed++;

    dailyStats.set(date, existing);
  }

  const completionTrends = Array.from(dailyStats.entries())
    .map(([date, stats]) => ({
      date,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      taskCount: stats.total,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate overall productivity score
  const totalBlocks = blocks.length;
  const completedBlocks = blocks.filter(b => b.status === 'completed').length;
  const avgCompletionRate = totalBlocks > 0 ? (completedBlocks / totalBlocks) * 100 : 0;

  const productivityScore = Math.round(
    (avgCompletionRate * 0.6) + // 60% weight on completion
    (Math.min(100, (totalBlocks / 30) * 20)) + // Activity bonus (max 20%)
    (peakHours.length > 0 ? Math.min(20, peakHours[0].productivity * 0.2) : 0) // Peak performance (max 20%)
  );

  // Generate recommendations
  const recommendations: string[] = [];

  if (peakHours.length > 0) {
    const bestHour = peakHours[0].hour;
    const timePeriod = bestHour >= 6 && bestHour < 12 ? 'morning'
      : bestHour >= 12 && bestHour < 17 ? 'afternoon'
      : bestHour >= 17 && bestHour < 22 ? 'evening'
      : 'night';
    recommendations.push(`Your peak productivity is in the ${timePeriod} (${bestHour}:00-${bestHour+1}:00). Schedule important tasks then.`);
  }

  if (avgCompletionRate < 60) {
    recommendations.push('Your completion rate is below 60%. Try breaking down large tasks into smaller chunks.');
  } else if (avgCompletionRate >= 85) {
    recommendations.push('Excellent completion rate! Consider taking on more challenging projects.');
  }

  const recentTrends = completionTrends.slice(-7);
  if (recentTrends.length >= 5) {
    const avgRecent = recentTrends.reduce((sum, t) => sum + t.completionRate, 0) / recentTrends.length;
    if (avgRecent > 80) {
      recommendations.push('You\'re on a productivity roll! Maintain your current workflow.');
    } else if (avgRecent < 50) {
      recommendations.push('Recent productivity has dipped. Consider reviewing your workload and energy management.');
    }
  }

  if (totalBlocks < 20) {
    recommendations.push('Try to be more consistent with time blocking. Aim for at least 5-6 blocks per day.');
  }

  return res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    productivityScore,
    peakHours,
    completionTrends,
    recommendations,
  } satisfies InsightsResponse);
}

export type EnergyPatternsResponse = {
  from: string;
  to: string;
  hourlyAnalysis: Array<{
    hour: number;
    avgEnergyLevel: number;
    taskCount: number;
    completionRate: number;
  }>;
  optimalSchedule: Array<{
    hour: number;
    recommendedTaskType: string;
    reasoning: string;
  }>;
  insights: string[];
};

async function handleEnergyPatterns(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string },
  from: Date,
  to: Date,
) {
  // Fetch completed time blocks with energy levels
  const blocks = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, me.sub),
    gte(timeBlocks.startAt, from),
    lte(timeBlocks.startAt, to),
    eq(timeBlocks.status, 'completed'),
  ));

  // Filter blocks with valid energy levels
  const blocksWithEnergy = blocks.filter(b => b.energyLevel && b.energyLevel > 0);

  if (blocksWithEnergy.length < 5) {
    return res.status(200).json({
      from: from.toISOString(),
      to: to.toISOString(),
      hourlyAnalysis: [],
      optimalSchedule: [],
      insights: [
        'Not enough data yet. Keep logging your energy levels during tasks to unlock energy pattern analysis.',
        'Tip: Rate your energy (1-5) when completing tasks to build your personal productivity profile.'
      ],
    } satisfies EnergyPatternsResponse);
  }

  // Analyze by hour
  const hourlyData = new Map<number, { energySum: number; count: number; completed: number; total: number }>();

  for (const block of blocks) {
    const hour = block.startAt.getUTCHours();
    const existing = hourlyData.get(hour) || { energySum: 0, count: 0, completed: 0, total: 0 };

    existing.total++;
    if (block.status === 'completed') existing.completed++;

    if (block.energyLevel) {
      existing.energySum += block.energyLevel;
      existing.count++;
    }

    hourlyData.set(hour, existing);
  }

  const hourlyAnalysis = Array.from(hourlyData.entries())
    .map(([hour, data]) => ({
      hour,
      avgEnergyLevel: data.count > 0 ? Math.round((data.energySum / data.count) * 10) / 10 : 0,
      taskCount: data.total,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }))
    .filter(h => h.taskCount >= 2)
    .sort((a, b) => a.hour - b.hour);

  // Generate optimal schedule recommendations
  const highEnergyHours = hourlyAnalysis
    .filter(h => h.avgEnergyLevel >= 4)
    .sort((a, b) => b.avgEnergyLevel - a.avgEnergyLevel);

  const lowEnergyHours = hourlyAnalysis
    .filter(h => h.avgEnergyLevel <= 2.5)
    .sort((a, b) => a.avgEnergyLevel - b.avgEnergyLevel);

  const optimalSchedule: Array<{
    hour: number;
    recommendedTaskType: string;
    reasoning: string;
  }> = [];

  for (const hourData of highEnergyHours.slice(0, 3)) {
    optimalSchedule.push({
      hour: hourData.hour,
      recommendedTaskType: 'Deep Work / Creative Tasks',
      reasoning: `High energy period (${hourData.avgEnergyLevel}/5). Best for focused, challenging work.`,
    });
  }

  for (const hourData of lowEnergyHours.slice(0, 2)) {
    optimalSchedule.push({
      hour: hourData.hour,
      recommendedTaskType: 'Admin / Routine Tasks',
      reasoning: `Lower energy period (${hourData.avgEnergyLevel}/5). Good for emails, planning, or routine work.`,
    });
  }

  // Generate insights
  const insights: string[] = [];

  if (highEnergyHours.length > 0) {
    const peakHour = highEnergyHours[0];
    insights.push(`Your peak energy is around ${peakHour.hour}:00 with average level ${peakHour.avgEnergyLevel}/5.`);
  }

  const avgEnergy = blocksWithEnergy.reduce((sum, b) => sum + (b.energyLevel || 0), 0) / blocksWithEnergy.length;
  if (avgEnergy >= 3.5) {
    insights.push('Your overall energy levels are healthy. You\'re maintaining good work-life balance.');
  } else if (avgEnergy < 2.5) {
    insights.push('Your energy levels seem consistently low. Consider rest, exercise, or workload adjustments.');
  }

  if (highEnergyHours.length >= 3) {
    insights.push(`You have ${highEnergyHours.length} high-energy hours identified. Protect these times for important work.`);
  }

  return res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    hourlyAnalysis,
    optimalSchedule,
    insights,
  } satisfies EnergyPatternsResponse);
}

export type CompletionRatesResponse = {
  taskCompletion: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgCompletionTime: number; // hours from creation to completion
    byPriority: Array<{ priority: number; total: number; completed: number; rate: number }>;
  };
  habitCompletion: {
    totalHabits: number;
    activeHabits: number;
    totalEntries: number;
    completedEntries: number;
    completionRate: number;
    streakData: Array<{ habitId: string; habitName: string; currentStreak: number; bestStreak: number }>;
  };
  weeklyTrends: Array<{ week: string; taskRate: number; habitRate: number }>;
  insights: string[];
};

async function handleCompletionRates(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string },
) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all user tasks
  const allTasks = await db.select().from(tasks).where(eq(tasks.userId, me.sub));

  // Fetch habit entries from last 30 days
  const habitEntriesData = await db.select().from(habitEntries).where(and(
    eq(habitEntries.userId, me.sub),
    gte(habitEntries.entryDate, thirtyDaysAgo),
  ));

  // Fetch user's habits
  const userHabits = await db.select().from(habits).where(eq(habits.userId, me.sub));

  // Calculate task completion metrics
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'done').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate average completion time
  const completedTasksWithDates = allTasks.filter(t =>
    t.status === 'done' && t.createdAt && t.updatedAt
  );

  const avgCompletionTime = completedTasksWithDates.length > 0
    ? completedTasksWithDates.reduce((sum, t) => {
        const created = new Date(t.createdAt).getTime();
        const completed = new Date(t.updatedAt).getTime();
        return sum + (completed - created) / (1000 * 60 * 60); // hours
      }, 0) / completedTasksWithDates.length
    : 0;

  // Analyze by priority
  const priorityBuckets = new Map<number, { total: number; completed: number }>();
  for (const task of allTasks) {
    const existing = priorityBuckets.get(task.priority) || { total: 0, completed: 0 };
    existing.total++;
    if (task.status === 'done') existing.completed++;
    priorityBuckets.set(task.priority, existing);
  }

  const byPriority = Array.from(priorityBuckets.entries())
    .map(([priority, data]) => ({
      priority,
      total: data.total,
      completed: data.completed,
      rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }))
    .sort((a, b) => a.priority - b.priority);

  // Calculate habit completion
  const totalHabits = userHabits.length;
  const activeHabits = userHabits.filter(h => h.frequency === 'daily' ||
    (h.frequency === 'weekly' && h.targetDays && h.targetDays.length > 0)).length;

  const totalEntries = habitEntriesData.length;
  const completedEntries = habitEntriesData.filter(e => e.completed).length;
  const habitCompletionRate = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;

  // Calculate streaks for each habit
  const streakData = await Promise.all(
    userHabits.map(async (habit) => {
      const entries = await db.select().from(habitEntries).where(and(
        eq(habitEntries.habitId, habit.id),
        eq(habitEntries.userId, me.sub),
        gte(habitEntries.entryDate, thirtyDaysAgo),
      ));

      // Calculate current streak (consecutive days)
      let currentStreak = 0;
      let bestStreak = 0;
      let tempStreak = 0;

      const sortedEntries = entries.sort((a, b) =>
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
      );

      for (let i = 0; i < sortedEntries.length; i++) {
        if (sortedEntries[i].completed) {
          tempStreak++;
          bestStreak = Math.max(bestStreak, tempStreak);

          // Check if consecutive day
          if (i > 0) {
            const currentDay = new Date(sortedEntries[i].entryDate).getDate();
            const prevDay = new Date(sortedEntries[i - 1].entryDate).getDate();
            if (currentDay !== prevDay - 1) {
              tempStreak = 1; // Reset if not consecutive
            }
          }
        } else {
          tempStreak = 0;
        }
      }

      // Get current streak (most recent consecutive days)
      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);

        const entry = entries.find(e =>
          new Date(e.entryDate).toDateString() === checkDate.toDateString()
        );

        if (entry && entry.completed) {
          streak++;
        } else {
          break;
        }
      }

      return {
        habitId: habit.id,
        habitName: habit.name,
        currentStreak: streak,
        bestStreak,
      };
    })
  );

  // Generate weekly trends
  const weeklyTrends: Array<{ week: string; taskRate: number; habitRate: number }> = [];

  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i * 7) - 6);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (i * 7));

    const weekKey = `${weekStart.toISOString().slice(0, 10)}`;

    const weekTasks = allTasks.filter(t => {
      if (!t.updatedAt) return false;
      const updated = new Date(t.updatedAt);
      return updated >= weekStart && updated <= weekEnd;
    });

    const weekHabits = habitEntriesData.filter(e => {
      const entryDate = new Date(e.entryDate);
      return entryDate >= weekStart && entryDate <= weekEnd;
    });

    const weekTaskRate = weekTasks.length > 0
      ? Math.round((weekTasks.filter(t => t.status === 'done').length / weekTasks.length) * 100)
      : 0;

    const weekHabitRate = weekHabits.length > 0
      ? Math.round((weekHabits.filter(e => e.completed).length / weekHabits.length) * 100)
      : 0;

    weeklyTrends.unshift({
      week: weekKey,
      taskRate: weekTaskRate,
      habitRate: weekHabitRate,
    });
  }

  // Generate insights
  const insights: string[] = [];

  if (taskCompletionRate >= 85) {
    insights.push(`Excellent task completion rate of ${taskCompletionRate}%. You're consistently delivering results.`);
  } else if (taskCompletionRate < 60) {
    insights.push(`Task completion rate is ${taskCompletionRate}%. Focus on finishing existing tasks before starting new ones.`);
  }

  if (avgCompletionTime > 168) { // More than a week
    insights.push(`Tasks take an average of ${Math.round(avgCompletionTime / 24)} days to complete. Consider breaking down larger projects.`);
  } else if (avgCompletionTime < 24) {
    insights.push('Great turnaround time! You complete tasks within a day on average.');
  }

  if (habitCompletionRate >= 80) {
    insights.push(`Strong habit consistency at ${habitCompletionRate}% completion. Keep it up!`);
  } else if (habitCompletionRate < 50) {
    insights.push('Habit completion could improve. Start with smaller, easier habits to build momentum.');
  }

  const bestStreakHabit = streakData.find(h => h.currentStreak >= 7);
  if (bestStreakHabit) {
    insights.push(`You're on a ${bestStreakHabit.currentStreak}-day streak with "${bestStreakHabit.habitName}"!`);
  }

  const priority1Rate = byPriority.find(p => p.priority === 1)?.rate || 0;
  if (priority1Rate < 70) {
    insights.push('High-priority tasks need more attention. Focus on completing urgent items first.');
  }

  return res.status(200).json({
    taskCompletion: {
      totalTasks,
      completedTasks,
      completionRate: taskCompletionRate,
      avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
      byPriority,
    },
    habitCompletion: {
      totalHabits,
      activeHabits,
      totalEntries,
      completedEntries,
      completionRate: habitCompletionRate,
      streakData,
    },
    weeklyTrends,
    insights,
  } satisfies CompletionRatesResponse);
}

export type MeetingCostsResponse = {
  from: string;
  to: string;
  summary: {
    totalMeetings: number;
    totalMeetingMinutes: number;
    totalCost: number;
    avgCostPerMeeting: number;
    avgCostPerHour: number;
    mostExpensiveMeeting: {
      title: string;
      cost: number;
      duration: number;
      date: string;
    } | null;
  };
  byPeriod: Array<{
    date: string;
    meetingCount: number;
    totalMinutes: number;
    totalCost: number;
  }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    startAt: string;
    duration: number;
    participantCount: number;
    cost: number;
    status: string;
  }>;
  insights: string[];
};

async function handleMeetingCosts(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string; role: string },
  from: Date,
  to: Date,
) {
  // Fetch user's hourly rate
  const [user] = await db.select({
    hourlyRate: users.hourlyRate,
  }).from(users).where(eq(users.id, me.sub)).limit(1);

  const hourlyRate = user?.hourlyRate || 0;

  // Fetch bookings where user is owner in the date range
  const userBookings = await db.select({
    id: bookings.id,
    title: bookings.title,
    startAt: bookings.startAt,
    endAt: bookings.endAt,
    status: bookings.status,
    visitorName: bookings.visitorName,
    calculatedCost: bookings.calculatedCost,
  }).from(bookings).where(and(
    eq(bookings.ownerUserId, me.sub),
    gte(bookings.startAt, from),
    lte(bookings.startAt, to),
  ));

  // Fetch meeting time blocks (where isMeeting is true)
  const meetingBlocks = await db.select({
    id: timeBlocks.id,
    title: timeBlocks.title,
    startAt: timeBlocks.startAt,
    endAt: timeBlocks.endAt,
    status: timeBlocks.status,
    calculatedCost: timeBlocks.calculatedCost,
  }).from(timeBlocks).where(and(
    eq(timeBlocks.userId, me.sub),
    eq(timeBlocks.isMeeting, true),
    gte(timeBlocks.startAt, from),
    lte(timeBlocks.startAt, to),
  ));

  // Combine and process all meetings
  const allMeetings = [
    ...userBookings.map(b => ({
      id: b.id,
      title: b.title,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.status,
      participantCount: 2, // Owner + visitor
      calculatedCost: b.calculatedCost,
    })),
    ...meetingBlocks.map(m => ({
      id: m.id,
      title: m.title,
      startAt: m.startAt,
      endAt: m.endAt,
      status: m.status,
      participantCount: 1, // Just the user
      calculatedCost: m.calculatedCost,
    })),
  ];

  // Calculate costs for meetings without stored cost
  const meetingsWithCost = allMeetings.map(meeting => {
    const duration = Math.round((new Date(meeting.endAt).getTime() - new Date(meeting.startAt).getTime()) / 60000);
    const cost = meeting.calculatedCost || (hourlyRate > 0 ? Math.round((hourlyRate / 60) * duration * meeting.participantCount) : 0);
    return {
      ...meeting,
      duration,
      cost,
    };
  });

  // Calculate summary statistics
  const totalMeetings = meetingsWithCost.length;
  const totalMeetingMinutes = meetingsWithCost.reduce((sum, m) => sum + m.duration, 0);
  const totalCost = meetingsWithCost.reduce((sum, m) => sum + m.cost, 0);
  const avgCostPerMeeting = totalMeetings > 0 ? Math.round(totalCost / totalMeetings) : 0;
  const totalHours = totalMeetingMinutes / 60;
  const avgCostPerHour = totalHours > 0 ? Math.round(totalCost / totalHours) : 0;

  // Find most expensive meeting
  const mostExpensiveMeeting = meetingsWithCost.length > 0
    ? meetingsWithCost.reduce((max, m) => m.cost > max.cost ? m : max, meetingsWithCost[0])
    : null;

  // Group by date for byPeriod analysis
  const byPeriodMap = new Map<string, { meetingCount: number; totalMinutes: number; totalCost: number }>();

  for (const meeting of meetingsWithCost) {
    const dateKey = meeting.startAt.toISOString().slice(0, 10);
    const existing = byPeriodMap.get(dateKey) || { meetingCount: 0, totalMinutes: 0, totalCost: 0 };
    existing.meetingCount++;
    existing.totalMinutes += meeting.duration;
    existing.totalCost += meeting.cost;
    byPeriodMap.set(dateKey, existing);
  }

  const byPeriod = Array.from(byPeriodMap.entries())
    .map(([date, data]) => ({
      date,
      meetingCount: data.meetingCount,
      totalMinutes: data.totalMinutes,
      totalCost: data.totalCost,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Get recent meetings (last 10)
  const recentMeetings = meetingsWithCost
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    .slice(0, 10)
    .map(m => ({
      id: m.id,
      title: m.title,
      startAt: m.startAt.toISOString(),
      duration: m.duration,
      participantCount: m.participantCount,
      cost: m.cost,
      status: m.status,
    }));

  // Generate insights
  const insights: string[] = [];

  if (totalMeetings === 0) {
    insights.push('No meetings found in this period. Keep up the focused work time!');
  } else {
    if (totalCost > 0) {
      insights.push(`Total meeting cost: $${totalCost.toLocaleString()} for ${totalMeetings} meetings.`);
      insights.push(`Average cost per meeting: $${avgCostPerMeeting}, average hourly cost: $${avgCostPerHour}.`);
    }

    const avgMeetingDuration = totalMeetingMinutes / totalMeetings;
    if (avgMeetingDuration > 60) {
      insights.push(`Average meeting length is ${Math.round(avgMeetingDuration)} minutes. Consider shorter meetings to reduce costs.`);
    } else if (avgMeetingDuration < 30) {
      insights.push('Good job keeping meetings concise! Average length is under 30 minutes.');
    }

    if (mostExpensiveMeeting) {
      const expensiveDuration = Math.round((new Date(mostExpensiveMeeting.endAt).getTime() - new Date(mostExpensiveMeeting.startAt).getTime()) / 60000);
      insights.push(`Most expensive meeting: "${mostExpensiveMeeting.title}" at $${mostExpensiveMeeting.cost} (${expensiveDuration}min).`);
    }

    // Calculate meeting intensity (meetings per day)
    const daysWithMeetings = byPeriod.length;
    const meetingsPerDay = daysWithMeetings > 0 ? totalMeetings / daysWithMeetings : 0;
    if (meetingsPerDay > 4) {
      insights.push('High meeting frequency detected. Consider consolidating or decluttering your calendar.');
    } else if (meetingsPerDay > 0 && meetingsPerDay <= 2) {
      insights.push('Good meeting discipline. You\'re keeping focused work time protected.');
    }
  }

  if (hourlyRate === 0) {
    insights.push('Set your hourly rate in settings to enable accurate meeting cost calculations.');
  }

  return res.status(200).json({
    from: from.toISOString(),
    to: to.toISOString(),
    summary: {
      totalMeetings,
      totalMeetingMinutes,
      totalCost,
      avgCostPerMeeting,
      avgCostPerHour,
      mostExpensiveMeeting: mostExpensiveMeeting ? {
        title: mostExpensiveMeeting.title,
        cost: mostExpensiveMeeting.cost,
        duration: mostExpensiveMeeting.duration,
        date: mostExpensiveMeeting.startAt.toISOString(),
      } : null,
    },
    byPeriod,
    recentMeetings,
    insights,
  } satisfies MeetingCostsResponse);
}

// ── Smart Schedule handler ───────────────────────────────────────────────────────

type SmartScheduleResponse = {
  taskId: string;
  taskTitle: string;
  taskPriority: number;
  taskEstimatedMinutes: number;
  recommendedSlots: Array<{
    date: string;
    startTime: string;
    endTime: string;
    confidence: number;
    reasoning: string;
    energyLevel: number;
  }>;
  energyInsights: {
    peakHours: number[];
    lowHours: number[];
    pattern: string;
  };
};

async function handleSmartSchedule(req: AuthedRequest, res: VercelResponse, me: { sub: string }) {
  const taskId = req.query.taskId ? String(req.query.taskId) : null;

  if (!taskId) {
    return res.status(400).json({ error: 'task_id_required' });
  }

  // Get task details
  const [task] = await db.select().from(tasks).where(
    and(eq(tasks.id, taskId), eq(tasks.userId, me.sub))
  );

  if (!task) {
    return res.status(404).json({ error: 'task_not_found' });
  }

  // Get user's energy patterns over the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const energyData = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, me.sub),
    gte(timeBlocks.startAt, thirtyDaysAgo),
    // Only include completed blocks with energy levels
  ));

  // Aggregate energy by hour of day
  const hourlyEnergy: Record<number, { total: number; count: number }> = {};

  for (const block of energyData) {
    if (block.energyLevel && block.status === 'completed') {
      const hour = block.startAt.getHours();
      if (!hourlyEnergy[hour]) {
        hourlyEnergy[hour] = { total: 0, count: 0 };
      }
      hourlyEnergy[hour].total += block.energyLevel;
      hourlyEnergy[hour].count += 1;
    }
  }

  // Calculate average energy per hour
  const hourlyAvgEnergy: Record<number, number> = {};
  for (const [hour, data] of Object.entries(hourlyEnergy)) {
    hourlyAvgEnergy[parseInt(hour)] = data.count > 0 ? data.total / data.count : 0;
  }

  // Find peak and low energy hours
  const peakHours = Object.entries(hourlyAvgEnergy)
    .filter(([_, energy]) => energy >= 4)
    .map(([hour]) => parseInt(hour))
    .sort((a, b) => a - b);

  const lowHours = Object.entries(hourlyAvgEnergy)
    .filter(([_, energy]) => energy <= 2)
    .map(([hour]) => parseInt(hour))
    .sort((a, b) => a - b);

  // Determine pattern
  let pattern = 'insufficient_data';
  if (Object.keys(hourlyAvgEnergy).length >= 5) {
    const morningAvg = [6, 7, 8, 9, 10, 11].reduce((sum, h) => sum + (hourlyAvgEnergy[h] || 0), 0) / 6;
    const afternoonAvg = [12, 13, 14, 15, 16, 17].reduce((sum, h) => sum + (hourlyAvgEnergy[h] || 0), 0) / 6;
    const eveningAvg = [18, 19, 20, 21, 22].reduce((sum, h) => sum + (hourlyAvgEnergy[h] || 0), 0) / 5;

    if (morningAvg > afternoonAvg && morningAvg > eveningAvg) {
      pattern = 'morning_person';
    } else if (afternoonAvg > morningAvg && afternoonAvg > eveningAvg) {
      pattern = 'afternoon_focused';
    } else if (eveningAvg > morningAvg && eveningAvg > afternoonAvg) {
      pattern = 'night_owl';
    } else {
      pattern = 'consistent';
    }
  }

  // Generate recommended time slots for the next 7 days
  const recommendedSlots: SmartScheduleResponse['recommendedSlots'] = [];
  const now = new Date();
  const workHours = [9, 10, 11, 14, 15, 16]; // Typical work hours (avoiding lunch)

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);

    // Check existing commitments for this day
    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existingBlocks = await db.select().from(timeBlocks).where(and(
      eq(timeBlocks.userId, me.sub),
      gte(timeBlocks.startAt, dayStart),
      lte(timeBlocks.startAt, dayEnd),
    ));

    // Find free slots during peak energy hours
    for (const hour of workHours) {
      // Skip if this hour is not in peak energy (for high priority tasks) or has decent energy
      const avgEnergy = hourlyAvgEnergy[hour] || 2.5;
      if (task.priority <= 2 && avgEnergy < 3.5) continue; // High priority needs good energy

      // Check if this hour is already booked
      const hourStart = new Date(date);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(date);
      hourEnd.setHours(hour + 1, 0, 0, 0);

      const isBooked = existingBlocks.some(block => {
        const blockStart = new Date(block.startAt);
        const blockEnd = new Date(block.endAt);
        return (blockStart < hourEnd && blockEnd > hourStart);
      });

      if (!isBooked) {
        // Calculate confidence based on energy level and data quality
        const confidence = Math.min(95, Math.round(
          (avgEnergy / 5) * 80 +
          (Math.min(5, Object.keys(hourlyAvgEnergy).length) / 5) * 20
        ));

        const reasoning = confidence > 80
          ? `Historically high energy time (${avgEnergy.toFixed(1)}/5 based on ${hourlyEnergy[hour]?.count || 0} sessions)`
          : confidence > 60
          ? `Moderate energy time (${avgEnergy.toFixed(1)}/5), limited data available`
          : `Best available slot, consider tracking energy for better recommendations`;

        recommendedSlots.push({
          date: date.toISOString().split('T')[0],
          startTime: `${String(hour).padStart(2, '0')}:00`,
          endTime: `${String(hour + 1).padStart(2, '0')}:00`,
          confidence,
          reasoning,
          energyLevel: Math.round(avgEnergy * 10) / 10,
        });

        // Only recommend top 2 slots per day
        if (recommendedSlots.filter(s => s.date === date.toISOString().split('T')[0]).length >= 2) {
          break;
        }
      }
    }
  }

  // Sort by confidence and limit to top 10 recommendations
  recommendedSlots.sort((a, b) => b.confidence - a.confidence);
  const topRecommendations = recommendedSlots.slice(0, 10);

  const energyInsights: SmartScheduleResponse['energyInsights'] = {
    peakHours: peakHours.length > 0 ? peakHours : [],
    lowHours: lowHours.length > 0 ? lowHours : [],
    pattern,
  };

  return res.status(200).json({
    taskId: task.id,
    taskTitle: task.title,
    taskPriority: task.priority,
    taskEstimatedMinutes: task.estimatedMinutes,
    recommendedSlots: topRecommendations,
    energyInsights,
  } satisfies SmartScheduleResponse);
}

// ── Activity Feed ────────────────────────────────────────────────────────────────

export type ActivityResponse = {
  activities: Array<{
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, any>;
    createdAt: string;
    user?: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  from: string;
  to: string;
  total: number;
};

async function handleActivities(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string; role?: string },
  from: Date,
  to: Date,
) {
  const action = req.query.action ? String(req.query.action) : undefined;
  const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;

  // Build where conditions
  const conditions = [
    gte(activityLog.createdAt, from),
    lte(activityLog.createdAt, to),
  ];

  // Filter by action type if specified
  if (action) {
    conditions.push(eq(activityLog.action, action));
  }

  // Filter by entity type if specified
  if (entityType) {
    conditions.push(eq(activityLog.entityType, entityType));
  }

  // Managers can see their team's activities, regular users only their own
  if (userId) {
    conditions.push(eq(activityLog.userId, userId));
  } else if (me.role !== 'admin' && me.role !== 'manager') {
    conditions.push(eq(activityLog.userId, me.sub));
  }

  // Fetch activities with user details
  const activities = await db
    .select({
      id: activityLog.id,
      userId: activityLog.userId,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      metadata: activityLog.metadata,
      createdAt: activityLog.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);

  // Format response
  const formattedActivities = activities.map((activity) => ({
    id: activity.id,
    userId: activity.userId,
    action: activity.action,
    entityType: activity.entityType,
    entityId: activity.entityId,
    metadata: activity.metadata,
    createdAt: activity.createdAt.toISOString(),
    user: activity.userName ? {
      id: activity.userId,
      name: activity.userName,
      email: activity.userEmail || '',
    } : undefined,
  }));

  return res.status(200).json({
    activities: formattedActivities,
    from: from.toISOString(),
    to: to.toISOString(),
    total: formattedActivities.length,
  } satisfies ActivityResponse);
}

// ── Burnout Risk handler ───────────────────────────────────────────────────────────

export type BurnoutRiskResponse = {
  from: string;
  to: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  factors: {
    workIntensity: {
      score: number; // 0-100
      avgDailyWorkHours: number;
      maxDailyHours: number;
      overtimeDays: number;
    };
    energyTrend: {
      score: number; // 0-100
      declining: boolean;
      avgEnergyLevel: number;
      recentEnergyAvg: number;
      earlierEnergyAvg: number;
    };
    vacationBalance: {
      score: number; // 0-100
      daysUsed: number;
      daysAvailable: number;
      daysSinceBreak: number;
      needsVacation: boolean;
    };
    workLifeBalance: {
      score: number; // 0-100
      weekendWork: number;
      eveningWork: number;
      lateNightWork: number;
    };
  };
  insights: string[];
  recommendations: string[];
  earlyWarnings: string[];
};

async function handleBurnoutRisk(
  req: AuthedRequest,
  res: VercelResponse,
  me: { sub: string },
  from: Date,
  to: Date,
) {
  // Fetch user data for vacation balance
  const [user] = await db.select({
    vacationDaysAvailable: users.vacationDaysAvailable,
    vacationDaysUsed: users.vacationDaysUsed,
    vacationAccrualLastReset: users.vacationAccrualLastReset,
  }).from(users).where(eq(users.id, me.sub)).limit(1);

  const vacationDaysAvailable = user?.vacationDaysAvailable || 20;
  const vacationDaysUsed = user?.vacationDaysUsed || 0;

  // Fetch time blocks for analysis (last 30 days minimum)
  const analysisFrom = new Date(Math.min(from.getTime(), Date.now() - 30 * 24 * 60 * 60 * 1000));
  const blocks = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, me.sub),
    gte(timeBlocks.startAt, analysisFrom),
    lte(timeBlocks.startAt, to),
  ));

  // Calculate work intensity metrics
  const dailyWorkMinutes = new Map<string, number>();
  const weekendWorkBlocks: typeof blocks = [];
  const eveningWorkBlocks: typeof blocks = [];
  const lateNightWorkBlocks: typeof blocks = [];

  for (const block of blocks) {
    const date = block.startAt;
    const dateKey = date.toISOString().slice(0, 10);
    const duration = Math.round((new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / 60000);

    dailyWorkMinutes.set(dateKey, (dailyWorkMinutes.get(dateKey) || 0) + duration);

    const dayOfWeek = date.getDay();
    const hour = date.getHours();

    // Track work-life balance violations
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendWorkBlocks.push(block);
    }
    if (hour >= 17 && hour < 21) {
      eveningWorkBlocks.push(block);
    }
    if (hour >= 21 || hour < 6) {
      lateNightWorkBlocks.push(block);
    }
  }

  const dailyHours = Array.from(dailyWorkMinutes.values()).map(mins => mins / 60);
  const avgDailyWorkHours = dailyHours.length > 0
    ? dailyHours.reduce((a, b) => a + b, 0) / dailyHours.length
    : 0;
  const maxDailyHours = dailyHours.length > 0 ? Math.max(...dailyHours) : 0;
  const overtimeDays = dailyHours.filter(h => h > 10).length;

  // Work intensity score (0-100, higher = more intense)
  let workIntensityScore = 0;
  if (avgDailyWorkHours > 10) workIntensityScore += 40;
  else if (avgDailyWorkHours > 8) workIntensityScore += 30;
  else if (avgDailyWorkHours > 6) workIntensityScore += 20;

  if (maxDailyHours > 12) workIntensityScore += 30;
  else if (maxDailyHours > 10) workIntensityScore += 20;

  if (overtimeDays > 5) workIntensityScore += 30;
  else if (overtimeDays > 2) workIntensityScore += 15;

  // Energy trend analysis
  const blocksWithEnergy = blocks.filter(b => b.energyLevel && b.energyLevel > 0);
  const midPoint = new Date(analysisFrom.getTime() + (to.getTime() - analysisFrom.getTime()) / 2);

  const earlierEnergy = blocksWithEnergy.filter(b => new Date(b.startAt) < midPoint);
  const recentEnergy = blocksWithEnergy.filter(b => new Date(b.startAt) >= midPoint);

  const earlierEnergyAvg = earlierEnergy.length > 0
    ? earlierEnergy.reduce((sum, b) => sum + (b.energyLevel || 0), 0) / earlierEnergy.length
    : 0;
  const recentEnergyAvg = recentEnergy.length > 0
    ? recentEnergy.reduce((sum, b) => sum + (b.energyLevel || 0), 0) / recentEnergy.length
    : 0;
  const overallEnergyAvg = blocksWithEnergy.length > 0
    ? blocksWithEnergy.reduce((sum, b) => sum + (b.energyLevel || 0), 0) / blocksWithEnergy.length
    : 0;

  const energyDeclining = recentEnergyAvg < earlierEnergyAvg && (earlierEnergyAvg - recentEnergyAvg) > 0.5;

  let energyTrendScore = 0;
  if (energyDeclining) {
    const declineSeverity = (earlierEnergyAvg - recentEnergyAvg) / earlierEnergyAvg;
    energyTrendScore = Math.min(100, declineSeverity * 100);
  }
  if (overallEnergyAvg < 2.5) energyTrendScore = Math.max(energyTrendScore, 60);
  else if (overallEnergyAvg < 3) energyTrendScore = Math.max(energyTrendScore, 30);

  // Vacation balance analysis
  const vacationUsageRate = vacationDaysUsed / (vacationDaysUsed + vacationDaysAvailable);
  const lastVacationReset = user?.vacationAccrualLastReset ? new Date(user.vacationAccrualLastReset) : new Date();
  const daysSinceLastReset = Math.floor((Date.now() - lastVacationReset.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceBreak = daysSinceLastReset; // Approximation

  let vacationBalanceScore = 0;
  if (vacationUsageRate > 0.8) vacationBalanceScore += 40;
  else if (vacationUsageRate > 0.6) vacationBalanceScore += 30;
  else if (vacationUsageRate > 0.4) vacationBalanceScore += 15;

  if (daysSinceBreak > 90) vacationBalanceScore += 40;
  else if (daysSinceBreak > 60) vacationBalanceScore += 25;
  else if (daysSinceBreak > 30) vacationBalanceScore += 10;

  const needsVacation = daysSinceBreak > 60 || vacationUsageRate > 0.7;

  // Work-life balance score
  const totalWeekendWork = weekendWorkBlocks.length;
  const totalEveningWork = eveningWorkBlocks.length;
  const totalLateNightWork = lateNightWorkBlocks.length;

  let workLifeBalanceScore = 0;
  if (totalWeekendWork > 4) workLifeBalanceScore += 35;
  else if (totalWeekendWork > 2) workLifeBalanceScore += 20;

  if (totalEveningWork > 8) workLifeBalanceScore += 30;
  else if (totalEveningWork > 4) workLifeBalanceScore += 15;

  if (totalLateNightWork > 3) workLifeBalanceScore += 35;
  else if (totalLateNightWork > 1) workLifeBalanceScore += 15;

  // Calculate overall burnout risk score
  const riskScore = Math.round(
    (workIntensityScore * 0.35 +
     energyTrendScore * 0.30 +
     vacationBalanceScore * 0.20 +
     workLifeBalanceScore * 0.15)
  );

  // Determine risk level
  let riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  if (riskScore >= 75) riskLevel = 'critical';
  else if (riskScore >= 50) riskLevel = 'high';
  else if (riskScore >= 25) riskLevel = 'moderate';
  else riskLevel = 'low';

  // Generate insights
  const insights: string[] = [];
  if (avgDailyWorkHours > 10) {
    insights.push(`You're averaging ${avgDailyWorkHours.toFixed(1)}h per day. Consider reducing workload.`);
  }
  if (energyDeclining) {
    insights.push('Your energy levels are declining over time. This is a common early burnout sign.');
  }
  if (totalWeekendWork > 2) {
    insights.push(`Working ${totalWeekendWork} weekends. Protect personal time for recovery.`);
  }
  if (needsVacation) {
    insights.push(`It's been ${daysSinceBreak} days since your last extended break. Plan time off.`);
  }
  if (overallEnergyAvg < 3 && blocksWithEnergy.length > 5) {
    insights.push('Your average energy is low. Prioritize rest and recovery activities.');
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (riskScore >= 50) {
    recommendations.push('Schedule a vacation or long weekend within the next 2 weeks.');
    recommendations.push('Reduce daily work hours to under 8h for the next week.');
  }
  if (totalWeekendWork > 0) {
    recommendations.push('Set strict boundaries: no weekend work for the next month.');
  }
  if (totalEveningWork > 4) {
    recommendations.push('Limit evening work to emergencies only during weekdays.');
  }
  if (energyDeclining) {
    recommendations.push('Add short breaks between work blocks (5-10 min every hour).');
    recommendations.push('Consider starting work later when your energy is naturally higher.');
  }
  if (vacationDaysAvailable > 5) {
    recommendations.push(`You have ${vacationDaysAvailable} vacation days available. Use them proactively.`);
  }

  // Early warnings
  const earlyWarnings: string[] = [];
  if (workIntensityScore > 60) {
    earlyWarnings.push('CRITICAL: Work intensity is unsustainable long-term.');
  }
  if (energyTrendScore > 50) {
    earlyWarnings.push('WARNING: Energy levels declining significantly.');
  }
  if (vacationBalanceScore > 50 && daysSinceBreak > 60) {
    earlyWarnings.push('ALERT: Overdue for extended time off.');
  }
  if (workLifeBalanceScore > 60) {
    earlyWarnings.push('CAUTION: Poor work-life balance detected.');
  }
  if (maxDailyHours > 14) {
    earlyWarnings.push('DANGER: Excessive daily work hours recorded.');
  }

  return res.status(200).json({
    from: analysisFrom.toISOString(),
    to: to.toISOString(),
    riskScore,
    riskLevel,
    factors: {
      workIntensity: {
        score: workIntensityScore,
        avgDailyWorkHours: Math.round(avgDailyWorkHours * 10) / 10,
        maxDailyHours: Math.round(maxDailyHours * 10) / 10,
        overtimeDays,
      },
      energyTrend: {
        score: energyTrendScore,
        declining: energyDeclining,
        avgEnergyLevel: Math.round(overallEnergyAvg * 10) / 10,
        recentEnergyAvg: Math.round(recentEnergyAvg * 10) / 10,
        earlierEnergyAvg: Math.round(earlierEnergyAvg * 10) / 10,
      },
      vacationBalance: {
        score: vacationBalanceScore,
        daysUsed: vacationDaysUsed,
        daysAvailable: vacationDaysAvailable,
        daysSinceBreak,
        needsVacation,
      },
      workLifeBalance: {
        score: workLifeBalanceScore,
        weekendWork: totalWeekendWork,
        eveningWork: totalEveningWork,
        lateNightWork: totalLateNightWork,
      },
    },
    insights,
    recommendations,
    earlyWarnings,
  } satisfies BurnoutRiskResponse);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildDayKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor < end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function startOfWeek(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function endOfWeek(d = new Date()) {
  const x = startOfWeek(d); x.setDate(x.getDate() + 7);
  return x;
}
