import { Task, TimeBlock } from '@/server/lib/db/schema';

export interface VelocityData {
  date: string;
  completed: number;
  created: number;
  completionRate: number;
}

export interface VelocityStats {
  daily: VelocityData[];
  weekly: VelocityData[];
  monthly: VelocityData[];
  currentDay: { completed: number; created: number; rate: number };
  currentWeek: { completed: number; created: number; rate: number };
  currentMonth: { completed: number; created: number; rate: number };
  trends: {
    daily: number; // percentage change from last period
    weekly: number;
    monthly: number;
  };
  bestDay: { date: string; completed: number } | null;
  averageDaily: number;
}

/**
 * Group tasks by date period
 */
function groupByPeriod(tasks: Task[], timeBlocks: TimeBlock[], period: 'day' | 'week' | 'month'): Map<string, { completed: number; created: number }> {
  const grouped = new Map<string, { completed: number; created: number }>();

  tasks.forEach(task => {
    const date = new Date(task.createdAt);
    let key: string;

    if (period === 'day') {
      key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    } else if (period === 'week') {
      // Get week number and year
      const oneJan = new Date(date.getFullYear(), 0, 1);
      const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
      const weekNum = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
      key = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
    } else {
      key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    const entry = grouped.get(key) || { completed: 0, created: 0 };
    entry.created++;
    grouped.set(key, entry);
  });

  // Count completed tasks based on time blocks with 'completed' status
  timeBlocks.forEach(block => {
    if (block.status === 'completed' && block.taskId) {
      const date = new Date(block.updatedAt || block.createdAt);
      let key: string;

      if (period === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'week') {
        const oneJan = new Date(date.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
        key = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
      } else {
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      const entry = grouped.get(key);
      if (entry) {
        entry.completed++;
      }
    }
  });

  return grouped;
}

/**
 * Calculate completion rate for a period
 */
function calculateRate(completed: number, created: number): number {
  if (created === 0) return 0;
  return Math.round((completed / created) * 100);
}

/**
 * Get current period key
 */
function getCurrentPeriodKey(period: 'day' | 'week' | 'month'): string {
  const now = new Date();

  if (period === 'day') {
    return now.toISOString().split('T')[0];
  } else if (period === 'week') {
    const oneJan = new Date(now.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((now.getDay() + 1 + numberOfDays) / 7);
    return `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
  } else {
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }
}

/**
 * Calculate velocity stats from tasks and time blocks
 */
export function calculateVelocityStats(tasks: Task[], timeBlocks: TimeBlock[]): VelocityStats {
  // Group by different periods
  const dailyGroups = groupByPeriod(tasks, timeBlocks, 'day');
  const weeklyGroups = groupByPeriod(tasks, timeBlocks, 'week');
  const monthlyGroups = groupByPeriod(tasks, timeBlocks, 'month');

  // Convert to arrays and sort
  const daily: VelocityData[] = Array.from(dailyGroups.entries())
    .map(([date, data]) => ({
      date,
      completed: data.completed,
      created: data.created,
      completionRate: calculateRate(data.completed, data.created),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekly: VelocityData[] = Array.from(weeklyGroups.entries())
    .map(([date, data]) => ({
      date,
      completed: data.completed,
      created: data.created,
      completionRate: calculateRate(data.completed, data.created),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const monthly: VelocityData[] = Array.from(monthlyGroups.entries())
    .map(([date, data]) => ({
      date,
      completed: data.completed,
      created: data.created,
      completionRate: calculateRate(data.completed, data.created),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Get current period stats
  const todayKey = getCurrentPeriodKey('day');
  const currentDayData = dailyGroups.get(todayKey) || { completed: 0, created: 0 };
  const currentDay = {
    completed: currentDayData.completed,
    created: currentDayData.created,
    rate: calculateRate(currentDayData.completed, currentDayData.created),
  };

  const weekKey = getCurrentPeriodKey('week');
  const currentWeekData = weeklyGroups.get(weekKey) || { completed: 0, created: 0 };
  const currentWeek = {
    completed: currentWeekData.completed,
    created: currentWeekData.created,
    rate: calculateRate(currentWeekData.completed, currentWeekData.created),
  };

  const monthKey = getCurrentPeriodKey('month');
  const currentMonthData = monthlyGroups.get(monthKey) || { completed: 0, created: 0 };
  const currentMonth = {
    completed: currentMonthData.completed,
    created: currentMonthData.created,
    rate: calculateRate(currentMonthData.completed, currentMonthData.created),
  };

  // Calculate trends (percentage change from previous period)
  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const todayIndex = daily.findIndex(d => d.date === todayKey);
  const yesterdayData = todayIndex > 0 ? daily[todayIndex - 1] : null;
  const dailyTrend = calculateTrend(currentDay.completed, yesterdayData?.completed || 0);

  const weekIndex = weekly.findIndex(w => w.date === weekKey);
  const lastWeekData = weekIndex > 0 ? weekly[weekIndex - 1] : null;
  const weeklyTrend = calculateTrend(currentWeek.completed, lastWeekData?.completed || 0);

  const monthIndex = monthly.findIndex(m => m.date === monthKey);
  const lastMonthData = monthIndex > 0 ? monthly[monthIndex - 1] : null;
  const monthlyTrend = calculateTrend(currentMonth.completed, lastMonthData?.completed || 0);

  // Find best day
  const bestDay = daily.length > 0
    ? daily.reduce((best, current) =>
        current.completed > best.completed ? current : best
      )
    : null;

  // Calculate average daily completions (last 7 days)
  const last7Days = daily.slice(-7);
  const averageDaily = last7Days.length > 0
    ? Math.round(last7Days.reduce((sum, d) => sum + d.completed, 0) / last7Days.length)
    : 0;

  return {
    daily,
    weekly,
    monthly,
    currentDay,
    currentWeek,
    currentMonth,
    trends: {
      daily: dailyTrend,
      weekly: weeklyTrend,
      monthly: monthlyTrend,
    },
    bestDay,
    averageDaily,
  };
}

/**
 * Format period key for display
 */
export function formatPeriodKey(key: string, period: 'day' | 'week' | 'month'): string {
  if (period === 'day') {
    const date = new Date(key);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (period === 'week') {
    const [year, week] = key.split('-W');
    return `W${week} ${year}`;
  } else {
    const date = new Date(key + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}
