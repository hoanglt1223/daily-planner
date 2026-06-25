import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { blockColor } from '@/lib/block-color';
import {
  WORKDAY_START_HOUR,
  WORKDAY_END_HOUR,
  minutesSinceMidnight,
  fmtHour,
  startOfDay,
  addDays,
} from '@/lib/time-utils';

type Block = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  taskId: string | null;
};

const TOTAL_HOURS = WORKDAY_END_HOUR - WORKDAY_START_HOUR;
const HOUR_PX = 48; // pixels per hour

export function DailyTimeline() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const navigate = useNavigate();

  function load() {
    setError(false);
    setLoading(true);
    const todayStart = startOfDay(new Date());
    const todayEnd = addDays(todayStart, 1);
    apiFetch<Block[]>(
      `/api/time-blocks?from=${todayStart.toISOString()}&to=${todayEnd.toISOString()}`,
    )
      .then(b => { setBlocks(b); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Tick every minute to keep "now" line accurate
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMinutes = minutesSinceMidnight(now);
  const nowOffset =
    nowMinutes >= WORKDAY_START_HOUR * 60 && nowMinutes < WORKDAY_END_HOUR * 60
      ? ((nowMinutes - WORKDAY_START_HOUR * 60) / 60) * HOUR_PX
      : null;

  // Compute positioned blocks
  const positioned = useMemo(() => {
    return blocks
      .map(b => {
        const startMin = minutesSinceMidnight(new Date(b.startAt));
        const endMin = minutesSinceMidnight(new Date(b.endAt));
        const topMin = Math.max(startMin, WORKDAY_START_HOUR * 60);
        const botMin = Math.min(endMin, WORKDAY_END_HOUR * 60);
        if (botMin <= topMin) return null;
        const top = ((topMin - WORKDAY_START_HOUR * 60) / 60) * HOUR_PX;
        const height = ((botMin - topMin) / 60) * HOUR_PX;
        const color = blockColor(b.taskId || b.title || b.id);
        return { ...b, top, height, color };
      })
      .filter(Boolean)
      .sort((a, b) => a!.top - b!.top);
  }, [blocks]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading timeline…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-5 text-center space-y-2">
          <p className="text-sm text-destructive">Failed to load timeline.</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => WORKDAY_START_HOUR + i);

  return (
    <Card className="cursor-pointer hover:shadow-soft-md transition-shadow" onClick={() => navigate('/planner')}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-muted-foreground" />
          <p className="text-sm font-medium">Today's timeline</p>
          {blocks.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {blocks.length} block{blocks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {blocks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No blocks scheduled today. Click to open planner.
          </p>
        ) : (
          <div
            className="relative ml-10 border-l"
            style={{ height: TOTAL_HOURS * HOUR_PX }}
          >
            {/* Hour grid lines + labels */}
            {hours.map(h => {
              const top = (h - WORKDAY_START_HOUR) * HOUR_PX;
              return (
                <div key={h} className="absolute w-full" style={{ top }}>
                  <span className="absolute -ml-10 w-9 text-right text-[10px] text-muted-foreground tabular-nums leading-none -translate-y-1/2">
                    {String(h).padStart(2, '0')}:00
                  </span>
                  <div className="absolute inset-x-0 border-t border-dashed border-muted" />
                </div>
              );
            })}

            {/* Time blocks */}
            {positioned.map(b => b && (
              <div
                key={b.id}
                className={cn(
                  'absolute inset-x-1 rounded-md border-l-2 px-1.5 py-0.5 overflow-hidden transition-colors',
                  b.color.bg,
                  b.color.border,
                  b.status === 'completed' && 'opacity-50',
                  b.status === 'in_progress' && 'ring-1 ring-primary/40',
                )}
                style={{ top: b.top, height: Math.max(b.height, 16) }}
                title={`${b.title} (${fmtHour(new Date(b.startAt))} – ${fmtHour(new Date(b.endAt))})`}
              >
                <p className={cn('text-[10px] font-medium truncate leading-tight', b.color.fg)}>
                  {b.title}
                </p>
                {b.height > 24 && (
                  <p className="text-[9px] text-muted-foreground leading-none">
                    {fmtHour(new Date(b.startAt))} – {fmtHour(new Date(b.endAt))}
                  </p>
                )}
              </div>
            ))}

            {/* Now line */}
            {nowOffset !== null && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10"
                style={{ top: nowOffset }}
              >
                <div className="flex items-center">
                  <div className="size-2 rounded-full bg-red-500 -ml-1" />
                  <div className="h-px flex-1 bg-red-500" />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
