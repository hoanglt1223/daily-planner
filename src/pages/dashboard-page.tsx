import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, Clock4, ListTodo, RefreshCw, TrendingUp, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { useQuickCaptureContext } from '@/components/quick-capture-provider';
import { SharePanel } from '@/components/dashboard/share-panel';
import { BookingsInbox } from '@/components/dashboard/bookings-inbox';
import { WeeklyChart } from '@/components/dashboard/weekly-chart';
import { TodayTasks } from '@/components/dashboard/today-tasks';
import { UpcomingTasks } from '@/components/dashboard/upcoming-tasks';
import { CompletedTasks } from '@/components/dashboard/completed-tasks';
import { ProductivityInsights } from '@/components/dashboard/productivity-insights';
import { TimesheetExport } from '@/components/dashboard/timesheet-export';
import { DailyTimeline } from '@/components/dashboard/daily-timeline';
import { DailyNotes } from '@/components/dashboard/daily-notes';
import { DailyFocus } from '@/components/dashboard/daily-focus';
import { DailyReview } from '@/components/dashboard/daily-review';
import { StreakCalendar } from '@/components/dashboard/streak-calendar';
import { TimeAllocation } from '@/components/dashboard/time-allocation';
import { PomodoroTimer } from '@/components/dashboard/pomodoro-timer';
import { SessionAnalyticsCard } from '@/components/dashboard/session-analytics-card';
import { EnergyPatterns } from '@/components/dashboard/energy-patterns';
import { GoalProgress } from '@/components/dashboard/goal-progress';
import { SmartPrioritization } from '@/components/dashboard/smart-prioritization';
import { EstimationAccuracy } from '@/components/dashboard/estimation-accuracy';
import { MeetingCostAnalytics } from '@/components/dashboard/meeting-cost-analytics';
import { VacationStatus } from '@/components/dashboard/vacation-status';
import { TaskVelocityDashboard } from '@/components/dashboard/task-velocity-dashboard';
import { QuickTaskCreate } from '@/components/dashboard/quick-task-create';
import { BudgetHealthAlert } from '@/components/dashboard/budget-health-alert';
import { AchievementsBadge } from '@/components/achievements-badge';
import { MusicPlayer } from '@/components/music-player';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, startOfWeek, WORKDAY_HOURS } from '@/lib/time-utils';
import { cn } from '@/lib/utils';

type Block = { startAt: string; endAt: string };

export function DashboardPage() {
  const { open: openQuickCapture } = useQuickCaptureContext();
  const [todayMin, setTodayMin] = useState<number | null>(null);
  const [weekMin, setWeekMin] = useState<number | null>(null);
  const [weekBlocks, setWeekBlocks] = useState<Block[]>([]);
  const [fetchError, setFetchError] = useState(false);

  const loadStats = useCallback(() => {
    setFetchError(false);
    setTodayMin(null);
    setWeekMin(null);
    setWeekBlocks([]);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = addDays(todayStart, 1);
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 7);
    Promise.all([
      apiFetch<Block[]>(`/api/time-blocks?from=${todayStart.toISOString()}&to=${todayEnd.toISOString()}`),
      apiFetch<Block[]>(`/api/time-blocks?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`),
    ]).then(([today, week]) => {
      setTodayMin(sumMinutes(today));
      setWeekMin(sumMinutes(week));
      setWeekBlocks(week);
    }).catch(() => setFetchError(true));
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const workDayMin = WORKDAY_HOURS * 60;
  const workWeekMin = workDayMin * 7;
  const todayFree = todayMin === null ? null : Math.max(0, workDayMin - todayMin);
  const weekLoadPct = weekMin === null ? null : Math.min(100, Math.round((weekMin / workWeekMin) * 100));

  const isEmpty = weekBlocks.length === 0 && todayMin === 0 && weekMin === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Today's overview</h1>
          <p className="text-sm text-muted-foreground">Workload, capacity, and pending requests at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <AchievementsBadge />
          <Button
            size="sm"
            onClick={openQuickCapture}
            className="gap-2 shrink-0"
          >
            <Sparkles className="size-4" />
            Quick Capture
            <kbd className="ml-1.5 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium">⌘K</kbd>
          </Button>
        </div>
      </div>

      <BudgetHealthAlert />

      {isEmpty && !fetchError && (
        <Card className="border-dashed border-2 border-muted-foreground/25 bg-muted/20">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <ListTodo className="size-8 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Nothing scheduled yet</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Create your first task then schedule it on the Planner to start tracking your day.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/tasks">Create a task</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/planner">Open Planner</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/priority-matrix">Priority Matrix</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {fetchError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center justify-between gap-4 py-4 px-5">
            <p className="text-sm text-destructive font-medium">
              Couldn't load capacity stats. Check your connection and try again.
            </p>
            <Button size="sm" variant="outline" onClick={loadStats} className="shrink-0 gap-1.5">
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Booked today" icon={Clock4} tone="sky"
            value={todayMin === null ? null : fmtHm(todayMin)} />
          <StatCard label="Free today" icon={CalendarCheck2} tone="emerald"
            value={todayFree === null ? null : fmtHm(todayFree)} />
          <StatCard label="Week load" icon={TrendingUp} tone="violet"
            value={weekLoadPct === null ? null : `${weekLoadPct}%`}
            sub={weekMin !== null ? `${fmtHm(weekMin)} of ${fmtHm(workWeekMin)}` : undefined}
            bar={weekLoadPct ?? undefined} />
        </div>
      )}

      <DailyTimeline />

      <ActivityFeed />

      <QuickTaskCreate />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <TodayTasks />
        <UpcomingTasks />
        <ProductivityInsights />
        <CompletedTasks />
      </div>

      <SmartPrioritization />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {weekBlocks.length > 0 && <WeeklyChart blocks={weekBlocks} />}
          <TimeAllocation />
          <StreakCalendar />
        </div>
        <div className="space-y-4">
          <PomodoroTimer />
          <SessionAnalyticsCard />
          <MusicPlayer />
          <GoalProgress />
          <DailyFocus />
          <DailyReview />
          <EnergyPatterns />
          <VacationStatus />
        </div>
      </div>

      <DailyNotes />

      <div className="grid gap-4 lg:grid-cols-2">
        <SharePanel />
        <BookingsInbox />
      </div>

      <EstimationAccuracy />

      <MeetingCostAnalytics />

      <TaskVelocityDashboard />

      <TimesheetExport />
    </div>
  );
}

function StatCard({ label, value, sub, bar, icon: Icon, tone }: {
  label: string; value: string | null; sub?: string; bar?: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'sky' | 'emerald' | 'violet';
}) {
  const tones = {
    sky:     { ring: 'ring-sky-200',     icon: 'text-sky-600',     bg: 'bg-sky-50',     bar: 'bg-sky-500' },
    emerald: { ring: 'ring-emerald-200', icon: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
    violet:  { ring: 'ring-violet-200',  icon: 'text-violet-600',  bg: 'bg-violet-50',  bar: 'bg-violet-500' },
  }[tone];
  return (
    <Card className={cn('relative overflow-hidden ring-1 transition-shadow hover:shadow-soft-md', tones.ring)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className={cn('rounded-md p-1.5', tones.bg)}>
            <Icon className={cn('size-4', tones.icon)} />
          </div>
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">
          {value === null ? <Skeleton className="h-9 w-24" /> : value}
        </div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {bar !== undefined && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full transition-all', tones.bar)} style={{ width: `${bar}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function sumMinutes(blocks: Block[]): number {
  return blocks.reduce((s, b) =>
    s + Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000), 0);
}
function fmtHm(min: number): string {
  const h = Math.floor(min / 60); const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}
