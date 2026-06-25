import { useEffect, useState } from 'react';
import { Pause, Play, CheckCircle2, X } from 'lucide-react';
import type { TimeBlock } from './use-planner-data';
import { fmtHour } from '@/lib/time-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { blockColor } from '@/lib/block-color';

export function FocusTimer({ block, onComplete, onStop }: {
  block: TimeBlock;
  onComplete: () => void;
  onStop: () => void;
}) {
  const endAt = new Date(block.endAt).getTime();
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  // Total accumulated pause duration in ms (mirrors pomodoro-timer approach)
  const [pausedMs, setPausedMs] = useState(0);
  // Wall-clock time when last pause started
  const [pausedAt, setPausedAt] = useState<number | null>(null);

  // Tick every second when not paused
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);

  // Effective remaining: shift end time forward by total pause duration
  const effectiveEndAt = endAt + pausedMs;
  const remaining = paused && pausedAt !== null
    ? Math.max(0, effectiveEndAt - pausedAt)
    : Math.max(0, effectiveEndAt - now);
  const totalMs = endAt - new Date(block.startAt).getTime();
  const elapsed = totalMs - remaining;
  const pct = totalMs > 0 ? Math.min(100, Math.round((elapsed / totalMs) * 100)) : 0;
  const isOvertime = remaining === 0 && !paused;
  const isAlmostDone = remaining > 0 && remaining <= 5 * 60_000; // last 5 min

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  // Overtime counts from the adjusted end, not the raw endAt
  const overtimeSec = isOvertime ? Math.floor((now - effectiveEndAt) / 1000) : 0;
  const otMin = Math.floor(overtimeSec / 60);
  const otSec = overtimeSec % 60;

  function togglePause() {
    if (paused && pausedAt !== null) {
      // Resume: accumulate the pause duration so the countdown is not penalised
      setPausedMs(ms => ms + (Date.now() - pausedAt));
      setPausedAt(null);
      setPaused(false);
    } else {
      setPausedAt(Date.now());
      setPaused(true);
    }
  }

  const color = blockColor(block.taskId || block.title || block.id);

  return (
    <Card className={cn(
      'fixed bottom-6 right-6 z-50 w-72 shadow-lg ring-1 transition-all',
      isOvertime ? 'ring-red-400 animate-pulse' : isAlmostDone ? 'ring-amber-400' : 'ring-border',
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('size-2 shrink-0 rounded-full', color.accent)} />
            <span className="text-sm font-medium truncate">{block.title}</span>
          </div>
          <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={onStop} title="Stop timer">
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Time display */}
        <div className="text-center">
          {isOvertime ? (
            <div className="space-y-0.5">
              <p className="text-2xl font-bold text-red-600 tabular-nums">
                +{String(otMin).padStart(2, '0')}:{String(otSec).padStart(2, '0')}
              </p>
              <p className="text-xs text-red-500">Overtime</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className={cn(
                'text-3xl font-bold tabular-nums',
                isAlmostDone ? 'text-amber-600' : 'text-foreground',
              )}>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </p>
              <p className="text-xs text-muted-foreground">
                {paused ? 'Paused' : isAlmostDone ? 'Almost done!' : 'remaining'}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full transition-all duration-1000',
              isOvertime ? 'bg-red-500' : isAlmostDone ? 'bg-amber-500' : 'bg-emerald-500',
            )}
            style={{ width: `${isOvertime ? 100 : pct}%` }}
          />
        </div>

        {/* Schedule info */}
        <p className="text-[10px] text-muted-foreground text-center">
          {fmtHour(new Date(block.startAt))} – {fmtHour(new Date(block.endAt))}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-2">
          {!isOvertime && (
            <Button size="sm" variant="outline" onClick={togglePause}>
              {paused ? <Play className="size-3.5 mr-1" /> : <Pause className="size-3.5 mr-1" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
          )}
          <Button size="sm" onClick={onComplete} className={cn(isOvertime && 'bg-red-600 hover:bg-red-700')}>
            <CheckCircle2 className="size-3.5 mr-1" />
            Complete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
