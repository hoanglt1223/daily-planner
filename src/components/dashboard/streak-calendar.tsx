import { useEffect, useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { addDays, startOfDay, fmtIsoDate } from '@/lib/time-utils';

type Block = { startAt: string; endAt: string; status: string };

const WEEKS = 20;
const TOTAL_DAYS = WEEKS * 7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Number of completed minutes from a block. */
function blockMinutes(b: Block): number {
  return Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000);
}

/** Color class for a given minute total. Thresholds tuned for a typical workday. */
function intensityClass(min: number): string {
  if (min === 0) return 'bg-muted/60';
  if (min < 60) return 'bg-emerald-200 dark:bg-emerald-900';
  if (min < 120) return 'bg-emerald-300 dark:bg-emerald-800';
  if (min < 240) return 'bg-emerald-400 dark:bg-emerald-700';
  return 'bg-emerald-600 dark:bg-emerald-500';
}

interface DayData {
  iso: string;
  minutes: number;
  date: Date;
}

/** GitHub-style streak calendar showing completed time-block minutes over the last ~20 weeks. */
export function StreakCalendar() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const from = addDays(startOfDay(now), -TOTAL_DAYS + 1);
    const to = addDays(startOfDay(now), 1);
    apiFetch<Block[]>(`/api/time-blocks?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(setBlocks)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const { grid, totalMinutes, activeDays, monthLabels } = useMemo(() => {
    const now = new Date();

    // Build day map
    const dayMap = new Map<string, number>();
    for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
      const d = addDays(startOfDay(now), -i);
      dayMap.set(fmtIsoDate(d), 0);
    }

    for (const b of blocks) {
      if (b.status !== 'completed') continue;
      const key = fmtIsoDate(new Date(b.startAt));
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) ?? 0) + blockMinutes(b));
      }
    }

    // Build week-column grid (columns = weeks, rows = days Mon..Sun)
    const allDays: DayData[] = [];
    for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
      const d = addDays(startOfDay(now), -i);
      const iso = fmtIsoDate(d);
      allDays.push({ iso, minutes: dayMap.get(iso) ?? 0, date: d });
    }

    // Group into weeks (Mon-start). Each week = 7 entries.
    const weeks: DayData[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }

    // Month labels: detect where a new month starts in the first row (Mon row)
    const labels: { weekIdx: number; name: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const mon = weeks[w][0];
      if (!mon) continue;
      const m = mon.date.getMonth();
      if (m !== lastMonth) {
        labels.push({ weekIdx: w, name: MONTHS[m] });
        lastMonth = m;
      }
    }

    let total = 0;
    let active = 0;
    for (const d of allDays) {
      total += d.minutes;
      if (d.minutes > 0) active++;
    }

    return { grid: weeks, totalMinutes: total, activeDays: active, monthLabels: labels };
  }, [blocks]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const shortDays = ['M', '', 'W', '', 'F', '', 'S'];

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-4 text-primary" />
            <p className="text-sm font-semibold">Activity streak</p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {fmtHm(totalMinutes)} · {activeDays} active day{activeDays !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Month labels */}
        <div className="flex gap-0.5 ml-5 text-[9px] text-muted-foreground leading-none select-none">
          {monthLabels.map((m, i) => (
            <span
              key={i}
              style={{ marginLeft: i === 0 ? 0 : undefined, minWidth: 0 }}
              className={cn(i === 0 && 'ml-0')}
            >
              {/* Spacer before the label to align with the correct week column */}
              {i > 0 && (
                <span style={{ display: 'inline-block', width: (m.weekIdx - monthLabels[i - 1].weekIdx) * 15 - 2 }} />
              )}
              {m.name}
            </span>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-0.5 overflow-x-auto">
          {/* Day-of-week rail */}
          <div className="flex flex-col gap-0.5 text-[9px] text-muted-foreground leading-none pr-1 select-none">
            {shortDays.map((d, i) => (
              <div key={i} className="flex items-center" style={{ height: 13 }}>
                {d}
              </div>
            ))}
          </div>

          {/* Week columns */}
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day) => (
                <div
                  key={day.iso}
                  className={cn(
                    'size-3 rounded-[2px] transition-colors',
                    intensityClass(day.minutes),
                    day.iso === fmtIsoDate(new Date()) && 'ring-1 ring-primary/50',
                  )}
                  title={`${day.iso}: ${fmtHm(day.minutes)}${day.minutes > 0 ? ' completed' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground select-none">
          <span>Less</span>
          <div className="size-2.5 rounded-[2px] bg-muted/60" />
          <div className="size-2.5 rounded-[2px] bg-emerald-200 dark:bg-emerald-900" />
          <div className="size-2.5 rounded-[2px] bg-emerald-300 dark:bg-emerald-800" />
          <div className="size-2.5 rounded-[2px] bg-emerald-400 dark:bg-emerald-700" />
          <div className="size-2.5 rounded-[2px] bg-emerald-600 dark:bg-emerald-500" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h${m}m` : `${h}h`;
}
