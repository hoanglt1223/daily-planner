import type { VercelResponse } from '@vercel/node';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../server/lib/db/client.js';
import { managerUsers, tasks, timeBlocks, users } from '../server/lib/db/schema.js';
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
