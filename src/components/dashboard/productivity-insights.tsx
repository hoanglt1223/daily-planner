import { useEffect, useMemo, useState } from 'react';
import { Flame, Target, TrendingUp, Trophy } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { addDays, startOfDay, fmtIsoDate } from '@/lib/time-utils';

type Block = { startAt: string; endAt: string; status: string };

/** Fetch completed + total stats for the last N days. */
export function ProductivityInsights() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const from = addDays(startOfDay(now), -6); // last 7 days inclusive
    const to = addDays(startOfDay(now), 1);
    apiFetch<Block[]>(`/api/time-blocks?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(setBlocks)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => computeInsights(blocks), [blocks]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const streakTone = stats.streak >= 7 ? 'amber' : stats.streak >= 3 ? 'emerald' : 'slate';
  const todayPct = stats.todayScheduled > 0
    ? Math.min(100, Math.round((stats.todayCompleted / stats.todayScheduled) * 100))
    : 0;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-sm font-medium">Productivity insights</p>

        {/* Top row: streak + today focus */}
        <div className="grid grid-cols-2 gap-3">
          {/* Streak */}
          <div className={cn(
            'rounded-lg p-3 ring-1',
            streakTone === 'amber' ? 'ring-amber-200 bg-amber-50/50'
              : streakTone === 'emerald' ? 'ring-emerald-200 bg-emerald-50/50'
                : 'ring-slate-200 bg-slate-50/50',
          )}>
            <div className="flex items-center gap-1.5 mb-1">
              <Flame className={cn('size-3.5',
                streakTone === 'amber' ? 'text-amber-500' : streakTone === 'emerald' ? 'text-emerald-500' : 'text-slate-400',
              )} />
              <span className="text-[10px] text-muted-foreground">Streak</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums leading-tight">
              {stats.streak} <span className="text-sm font-normal text-muted-foreground">days</span>
            </p>
          </div>

          {/* Today focus */}
          <div className="rounded-lg p-3 ring-1 ring-sky-200 bg-sky-50/50">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="size-3.5 text-sky-500" />
              <span className="text-[10px] text-muted-foreground">Today</span>
            </div>
            <p className="text-2xl font-semibold tabular-nums leading-tight">
              {fmtHm(stats.todayCompleted)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {stats.todayScheduled > 0 ? `${todayPct}% of ${fmtHm(stats.todayScheduled)}` : 'No blocks scheduled'}
            </p>
          </div>
        </div>

        {/* 7-day completion trend */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">7-day completion</span>
          </div>
          <div className="flex items-end gap-1.5" style={{ height: 48 }}>
            {stats.days.map((d) => {
              const pct = d.scheduled > 0 ? Math.min(100, (d.completed / d.scheduled) * 100) : 0;
              const isToday = d.iso === fmtIsoDate(new Date());
              return (
                <div key={d.iso} className="flex flex-1 flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-all',
                      d.completed === 0 && d.scheduled === 0 ? 'bg-muted/40'
                        : pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400',
                      isToday && 'ring-1 ring-primary/30',
                    )}
                    style={{
                      height: d.scheduled > 0 ? `${Math.max(pct, 8)}%` : '4%',
                      minHeight: d.scheduled > 0 ? 6 : 2,
                    }}
                    title={`${d.dayName}: ${fmtHm(d.completed)} / ${fmtHm(d.scheduled)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            {stats.days.map(d => (
              <span key={d.iso} className={cn(
                'flex-1 text-center text-[9px] leading-none',
                d.iso === fmtIsoDate(new Date()) ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}>
                {d.dayName}
              </span>
            ))}
          </div>
        </div>

        {/* Best day badge */}
        {stats.bestDay && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
            <Trophy className="size-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700">
              Best day: <strong>{stats.bestDay.dayName}</strong> with {fmtHm(stats.bestDay.completed)} completed
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DayStats {
  iso: string;
  dayName: string;
  scheduled: number;
  completed: number;
}

interface Insights {
  streak: number;
  todayCompleted: number;
  todayScheduled: number;
  days: DayStats[];
  bestDay: DayStats | null;
}

function computeInsights(blocks: Block[]): Insights {
  const now = new Date();
  const todayIso = fmtIsoDate(now);
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build 7-day map
  const dayMap = new Map<string, { scheduled: number; completed: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = addDays(startOfDay(now), -i);
    dayMap.set(fmtIsoDate(d), { scheduled: 0, completed: 0 });
  }

  for (const b of blocks) {
    const dayKey = fmtIsoDate(new Date(b.startAt));
    const entry = dayMap.get(dayKey);
    if (!entry) continue;
    const dur = Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000);
    entry.scheduled += dur;
    if (b.status === 'completed') entry.completed += dur;
  }

  // Build days array
  const days: DayStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(startOfDay(now), -i);
    const iso = fmtIsoDate(d);
    const entry = dayMap.get(iso)!;
    const dow = d.getDay();
    days.push({ iso, dayName: shortDays[dow], ...entry });
  }

  // Streak: count consecutive days (from today backwards) with ≥1 completed minute
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].completed > 0) streak++;
    else break;
  }

  // Today stats
  const todayEntry = dayMap.get(todayIso) ?? { scheduled: 0, completed: 0 };

  // Best day (most completed)
  let bestDay: DayStats | null = null;
  for (const d of days) {
    if (d.completed > 0 && (!bestDay || d.completed > bestDay.completed)) {
      bestDay = d;
    }
  }

  return {
    streak,
    todayCompleted: todayEntry.completed,
    todayScheduled: todayEntry.scheduled,
    days,
    bestDay,
  };
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}
