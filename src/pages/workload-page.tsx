import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronDown, Clock, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { addDays, diffMinutes, fmtIsoDate, startOfDay, WORKDAY_HOURS } from '@/lib/time-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ForecastBlock = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  isVacation: boolean;
  isMeeting: boolean;
};

type Horizon = 7 | 14 | 30;

const CAPACITY_MINUTES = WORKDAY_HOURS * 60;

function loadClass(pct: number): string {
  if (pct > 100) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function fmtHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function WorkloadPage() {
  const [blocks, setBlocks] = useState<ForecastBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState<Horizon>(14);
  const [openDay, setOpenDay] = useState<string | null>(null);

  useEffect(() => {
    const from = startOfDay(new Date());
    const to = addDays(from, horizon);
    setLoading(true);
    apiFetch<ForecastBlock[]>(`/api/time-blocks?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(setBlocks)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [horizon]);

  const days = useMemo(() => {
    const from = startOfDay(new Date());
    const byDay = new Map<string, ForecastBlock[]>();
    for (const b of blocks) {
      const key = fmtIsoDate(new Date(b.startAt));
      const arr = byDay.get(key) ?? [];
      arr.push(b);
      byDay.set(key, arr);
    }
    const list = Array.from({ length: horizon }, (_, i) => {
      const day = addDays(from, i);
      const key = fmtIsoDate(day);
      const dayBlocks = (byDay.get(key) ?? []).filter(b => b.status !== 'skipped' && !b.isVacation);
      const booked = dayBlocks.reduce((s, b) => s + diffMinutes(new Date(b.startAt), new Date(b.endAt)), 0);
      const free = Math.max(0, CAPACITY_MINUTES - booked);
      const pct = Math.round((booked / CAPACITY_MINUTES) * 100);
      const jsDow = day.getDay();
      return { day, key, booked, free, pct, blocks: dayBlocks, isWeekend: jsDow === 0 || jsDow === 6 };
    });
    return list;
  }, [blocks, horizon]);

  const summary = useMemo(() => {
    const totalBooked = days.reduce((s, d) => s + d.booked, 0);
    const totalFree = days.reduce((s, d) => s + d.free, 0);
    const overloadDays = days.filter(d => d.pct > 100).length;
    const busiest = days.reduce<typeof days[number] | null>(
      (max, d) => (max === null || d.booked > max.booked ? d : max),
      null,
    );
    return { totalBooked, totalFree, overloadDays, busiest };
  }, [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workload Forecast</h1>
          <p className="text-sm text-muted-foreground">
            See where your time is committed over the next {horizon} days — and where you still have room.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
          {([7, 14, 30] as Horizon[]).map(h => (
            <Button
              key={h}
              size="sm"
              variant={horizon === h ? 'default' : 'ghost'}
              className="h-7 px-3"
              onClick={() => setHorizon(h)}
            >
              {h}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon={<Clock className="size-4" />} label="Committed" value={fmtHM(summary.totalBooked)} hint={`across ${horizon} days`} />
        <SummaryCard icon={<CalendarDays className="size-4" />} label="Free capacity" value={fmtHM(summary.totalFree)} hint={`@ ${WORKDAY_HOURS}h/day`} />
        <SummaryCard
          icon={<AlertTriangle className="size-4" />}
          label="Overloaded days"
          value={String(summary.overloadDays)}
          hint={summary.overloadDays > 0 ? 'over 100% booked' : 'none — looking healthy'}
          tone={summary.overloadDays > 0 ? 'warn' : 'ok'}
        />
        <SummaryCard
          icon={<TrendingUp className="size-4" />}
          label="Busiest day"
          value={summary.busiest && summary.busiest.booked > 0 ? fmtIsoDate(summary.busiest.day).slice(5) : '—'}
          hint={summary.busiest && summary.busiest.booked > 0 ? `${fmtHM(summary.busiest.booked)} booked` : 'nothing scheduled'}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <ul className="divide-y">
              {days.map(d => {
                const open = openDay === d.key;
                const noBookings = d.blocks.length === 0;
                return (
                  <li key={d.key}>
                    <button
                      type="button"
                      onClick={() => setOpenDay(open ? null : d.key)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className={cn('w-20 shrink-0', d.isWeekend && 'text-muted-foreground')}>
                        <div className="text-sm font-medium">
                          {d.day.toLocaleDateString(undefined, { weekday: 'short' })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.day.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full transition-all', loadClass(d.pct))}
                            style={{ width: `${Math.min(100, d.pct)}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{fmtHM(d.booked)} booked</span>
                          <span>·</span>
                          <span>{fmtHM(d.free)} free</span>
                          {d.isWeekend && <Badge variant="outline" className="px-1 py-0 text-[10px]">weekend</Badge>}
                        </div>
                      </div>
                      <div className="flex w-14 shrink-0 items-center justify-end gap-1.5">
                        {d.pct > 100 && <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">{d.pct}%</Badge>}
                        {!noBookings && (
                          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
                        )}
                      </div>
                    </button>
                    {open && !noBookings && (
                      <ul className="space-y-1.5 bg-muted/30 px-4 pb-3 pt-1 pl-[7.5rem]">
                        {d.blocks
                          .slice()
                          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
                          .map(b => (
                            <li key={b.id} className="flex items-center gap-2 text-sm">
                              <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                                {new Date(b.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="truncate">{b.title}</span>
                              {b.isMeeting && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">meeting</Badge>}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {fmtHM(diffMinutes(new Date(b.startAt), new Date(b.endAt)))}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon, label, value, hint, tone,
}: {
  icon: React.ReactNode; label: string; value: string; hint: string; tone?: 'ok' | 'warn';
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn(
          'grid size-9 shrink-0 place-items-center rounded-md',
          tone === 'warn' ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary',
        )}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold leading-tight">{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
