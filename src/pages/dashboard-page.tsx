import { useEffect, useState } from 'react';
import { CalendarCheck2, Clock4, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { SharePanel } from '@/components/dashboard/share-panel';
import { BookingsInbox } from '@/components/dashboard/bookings-inbox';
import { WeeklyChart } from '@/components/dashboard/weekly-chart';
import { TodayTasks } from '@/components/dashboard/today-tasks';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, startOfWeek } from '@/lib/time-utils';
import { cn } from '@/lib/utils';

type Block = { startAt: string; endAt: string };

export function DashboardPage() {
  const [todayMin, setTodayMin] = useState<number | null>(null);
  const [weekMin, setWeekMin] = useState<number | null>(null);
  const [weekBlocks, setWeekBlocks] = useState<Block[]>([]);

  useEffect(() => {
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
    }).catch(() => undefined);
  }, []);

  const workDayMin = 16 * 60;
  const workWeekMin = workDayMin * 7;
  const todayFree = todayMin === null ? null : Math.max(0, workDayMin - todayMin);
  const weekLoadPct = weekMin === null ? null : Math.min(100, Math.round((weekMin / workWeekMin) * 100));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Today's overview</h1>
        <p className="text-sm text-muted-foreground">Workload, capacity, and pending requests at a glance.</p>
      </div>

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

      {weekBlocks.length > 0 && <WeeklyChart blocks={weekBlocks} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <TodayTasks />
        <SharePanel />
        <BookingsInbox />
      </div>
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
    <Card className={cn('relative overflow-hidden ring-1 transition-shadow hover:shadow-md', tones.ring)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className={cn('rounded-md p-1.5', tones.bg)}>
            <Icon className={cn('size-4', tones.icon)} />
          </div>
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight">
          {value === null ? <Skeleton className="h-9 w-24" /> : value}
        </p>
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
