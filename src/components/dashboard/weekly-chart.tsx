import { useMemo } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { getActiveTimeZone, WORKDAY_END_HOUR, WORKDAY_START_HOUR } from '@/lib/time-utils';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type DayEntry = { startAt: string; endAt: string };

/** Target work hours used as the "full" reference line. */
const TARGET_HOURS = (WORKDAY_END_HOUR - WORKDAY_START_HOUR);

export function WeeklyChart({ blocks }: { blocks: DayEntry[] }) {
  const days = useMemo(() => computeDays(blocks), [blocks]);
  const maxHours = TARGET_HOURS;

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium">Weekly overview</p>
        <p className="text-xs text-muted-foreground mb-4">
          Hours scheduled per day (target {TARGET_HOURS}h)
        </p>

        {/* Bar chart */}
        <div className="flex items-end gap-2" style={{ height: 140 }}>
          {days.map((d) => {
            const pct = maxHours > 0 ? Math.min(100, (d.hours / maxHours) * 100) : 0;
            const tone = d.hours >= TARGET_HOURS ? 'red' : d.hours >= TARGET_HOURS * 0.6 ? 'amber' : 'emerald';
            const isWeekend = d.dayName === 'Sun' || d.dayName === 'Sat';

            return (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                {/* Hour value on top of bar */}
                <span className={cn(
                  'text-[10px] font-medium leading-none',
                  d.hours > 0 ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {d.hours > 0 ? `${d.hours}h` : '—'}
                </span>

                {/* Bar */}
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-all',
                    d.hours === 0
                      ? 'bg-muted/50'
                      : isWeekend
                        ? toneBar(tone, true)
                        : toneBar(tone, false),
                  )}
                  style={{
                    height: d.hours > 0 ? `${Math.max(pct, 6)}%` : `${4}%`,
                    minHeight: d.hours > 0 ? 16 : 4,
                  }}
                  title={`${d.dayName}: ${d.hours}h scheduled of ${TARGET_HOURS}h target`}
                />

                {/* Day label */}
                <span className={cn(
                  'text-[10px] leading-none',
                  isWeekend ? 'text-muted-foreground' : 'text-foreground',
                )}>
                  {d.dayName}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface DayRow {
  label: string;
  dayName: string;
  hours: number;
}

function computeDays(blocks: DayEntry[]): DayRow[] {
  const DEFAULT_TZ = getActiveTimeZone();
  // Find the Monday of the current week in user TZ
  const now = new Date();
  const iso = formatInTimeZone(now, DEFAULT_TZ, 'yyyy-MM-dd');
  const dow = Number(formatInTimeZone(now, DEFAULT_TZ, 'i')); // 1=Mon..7=Sun
  const monOffset = dow - 1;

  const monday = new Date(new Date(`${iso}T00:00:00`).getTime() - monOffset * 86_400_000);

  // Aggregate minutes per day key (Mon..Sun)
  const minutesByDay: Record<string, number> = {};
  for (const b of blocks) {
    const bStart = new Date(b.startAt);
    const dayKey = formatInTimeZone(bStart, DEFAULT_TZ, 'yyyy-MM-dd');
    const mins = Math.round((new Date(b.endAt).getTime() - bStart.getTime()) / 60_000);
    minutesByDay[dayKey] = (minutesByDay[dayKey] || 0) + mins;
  }

  // Build 7 day rows
  const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday.getTime() + i * 86_400_000);
    const label = formatInTimeZone(date, DEFAULT_TZ, 'yyyy-MM-dd');
    const hours = Math.round((minutesByDay[label] || 0) / 60 * 10) / 10;
    return { label, dayName: shortDays[i], hours };
  });
}

function toneBar(tone: string, weekend: boolean) {
  if (weekend) {
    return tone === 'red' ? 'bg-red-400/60' : tone === 'amber' ? 'bg-amber-400/60' : 'bg-emerald-400/60';
  }
  return tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
}
