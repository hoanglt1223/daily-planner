import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, Square, CheckCircle2, Timer, ChevronDown, Coffee,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/* ─── Types ─── */

type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done' | 'archived';

interface Task {
  id: string; title: string; status: TaskStatus; priority: number;
  estimatedMinutes: number; categoryId: string | null;
}

interface PomodoroState {
  taskId: string;
  taskTitle: string;
  durationMs: number;
  startedAt: number; // Date.now()
  pausedMs: number;  // accumulated pause time
  pausedAt: number | null;
  completed: boolean;
}

/* ─── Constants ─── */

const STORAGE_KEY = 'pomodoro_state';

const DURATION_OPTIONS = [
  { label: '15m', ms: 15 * 60_000 },
  { label: '25m', ms: 25 * 60_000 },
  { label: '45m', ms: 45 * 60_000 },
  { label: '60m', ms: 60 * 60_000 },
];

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Urgent', 2: 'High', 3: 'Normal', 4: 'Low', 5: 'Someday',
};

/* ─── Component ─── */

export function PomodoroTimer() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<PomodoroState | null>(() => loadState());
  const [now, setNow] = useState(Date.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load tasks
  useEffect(() => {
    apiFetch<Task[]>('/api/tasks')
      .then(t => setTasks(t.filter(x => x.status !== 'done' && x.status !== 'archived')))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  // Tick every second when running
  useEffect(() => {
    if (!state || state.completed || state.pausedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  // Persist state
  useEffect(() => { saveState(state); }, [state]);

  // Compute derived values
  const remaining = useMemo(() => {
    if (!state) return 0;
    if (state.completed) return 0;
    const elapsed = (state.pausedAt ?? now) - state.startedAt - state.pausedMs;
    return Math.max(0, state.durationMs - elapsed);
  }, [state, now]);

  const isRunning = !!state && !state.pausedAt && !state.completed;
  const isPaused = !!state && !!state.pausedAt && !state.completed;
  const isComplete = !!state?.completed;
  const progressPct = state ? Math.min(100, Math.round(((state.durationMs - remaining) / state.durationMs) * 100)) : 0;

  // Check completion
  useEffect(() => {
    if (state && !state.completed && remaining === 0) {
      setState(s => s ? { ...s, completed: true } : null);
      playAlarm();
      toast.success(`Focus session complete: "${state.taskTitle}"`, {
        description: 'Great work! Take a break before your next session.',
        duration: 8000,
      });
    }
  }, [state, remaining]);

  const handleStart = useCallback((task: Task, durationMs: number) => {
    setState({
      taskId: task.id,
      taskTitle: task.title,
      durationMs,
      startedAt: Date.now(),
      pausedMs: 0,
      pausedAt: null,
      completed: false,
    });
    setExpanded(false);
  }, []);

  const handlePause = useCallback(() => {
    setState(s => s ? { ...s, pausedAt: Date.now() } : null);
  }, []);

  const handleResume = useCallback(() => {
    setState(s => {
      if (!s || !s.pausedAt) return s;
      return { ...s, pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null };
    });
  }, []);

  const handleStop = useCallback(() => {
    setState(null);
  }, []);

  const handleMarkDone = useCallback(async () => {
    if (!state) return;
    try {
      await apiFetch(`/api/tasks/${state.taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      });
      toast.success(`"${state.taskTitle}" marked done!`);
      setState(null);
    } catch (e) { toast.error((e as Error).message); }
  }, [state]);

  const handleSkip = useCallback(() => {
    setState(null);
    toast.info('Session skipped');
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ring-1 ring-amber-200 dark:ring-amber-800/50">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <Timer className="size-4 text-amber-600" />
          <p className="text-sm font-semibold">Focus timer</p>
          {isRunning && (
            <Badge variant="secondary" className="ml-auto text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
              Running
            </Badge>
          )}
          {isPaused && (
            <Badge variant="secondary" className="ml-auto text-[9px] bg-amber-100 text-amber-700 border-amber-200">
              Paused
            </Badge>
          )}
          {isComplete && (
            <Badge variant="secondary" className="ml-auto text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">
              Done!
            </Badge>
          )}
        </div>

        {/* Timer display or task selector */}
        {state ? (
          <div className="space-y-3">
            {/* Task name */}
            <p className="text-xs text-muted-foreground truncate" title={state.taskTitle}>
              {state.taskTitle}
            </p>

            {/* Time display */}
            <div className="text-center">
              {isComplete ? (
                <div className="space-y-1">
                  <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                  <p className="text-lg font-semibold text-emerald-600">Session complete!</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className={cn(
                    'text-4xl font-bold tabular-nums',
                    remaining <= 5 * 60_000 && remaining > 0 ? 'text-amber-600' : 'text-foreground',
                  )}>
                    {fmtCountdown(remaining)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isPaused ? 'Paused — click resume to continue' : 'remaining'}
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full transition-all duration-1000',
                  isComplete ? 'bg-emerald-500' : isPaused ? 'bg-amber-400' : 'bg-amber-500',
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-2">
              {isComplete ? (
                <>
                  <Button size="sm" onClick={handleMarkDone}>
                    <CheckCircle2 className="size-3.5 mr-1" /> Mark task done
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleSkip}>
                    <Coffee className="size-3.5 mr-1" /> Dismiss
                  </Button>
                </>
              ) : isRunning ? (
                <>
                  <Button size="sm" variant="outline" onClick={handlePause}>
                    <Pause className="size-3.5 mr-1" /> Pause
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleStop}>
                    <Square className="size-3.5 mr-1" /> Stop
                  </Button>
                </>
              ) : isPaused ? (
                <>
                  <Button size="sm" onClick={handleResume}>
                    <Play className="size-3.5 mr-1" /> Resume
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleStop}>
                    <Square className="size-3.5 mr-1" /> Stop
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Task selector */}
            {tasks.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground">No active tasks. Create a task first.</p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center justify-between w-full rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="text-muted-foreground">Select a task…</span>
                  <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                </button>

                {expanded && (
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-1.5">
                    {tasks
                      .sort((a, b) => a.priority - b.priority)
                      .map(task => (
                        <div key={task.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{task.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {PRIORITY_LABEL[task.priority] ?? 'Normal'} · {fmtEst(task.estimatedMinutes)}
                            </p>
                          </div>
                          {DURATION_OPTIONS.map(opt => (
                            <Button
                              key={opt.label}
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] shrink-0"
                              onClick={() => handleStart(task, opt.ms)}
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}

            {/* Quick start hint */}
            <p className="text-[10px] text-muted-foreground text-center">
              Select a task and duration to start a focus session
            </p>
          </div>
        )}

        {/* Hidden audio element for alarm */}
        <audio ref={audioRef} preload="auto">
          <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2DgYF8eHx/goODg4J+eHR1eoCEhYOBfnp2dXl+g4WEg4B8eHV2en+Dg4OCf3t4dnd7gIKCgoB9enh3eXyAgYKBf3x5eHh6fICBgYF/fHp4eXp8f4GBgX99e3l5ent+gICBf317eXl6e31/gICAfnx6eXl6e31/gIB+fXt5eXp7fX+AgH59e3l5ent9f4CAfn17eXl6e31/gIB+fXt5eXp7fX+AgH59e3l5ent9f4B/fn17eXl6e31/gH9+fXt5eXp7fX+Af359e3l5ent9f4B/fn17eXl6e31/gH9+fXt5eXp7fX+Af359e3l5ent9f39/fn17eXl6e31/f39+fXt5eXp7fX9/f359e3l5ent9f39/fn17eXl6e31/f39+fXt5eXp7fX9/f359e3l5ent9f35+fXt5eXp7fX5+fXt5eXp7fX5+fXt5eXp7fX1+fXt5eXp7fX19fX17eXl6e319fX19e3l5ent9fX19fXt5eXp7fX19fX19e3l5ent9fX19fX17eXl6e319fX19fX17eXl6e319fH19fX17eXl6e318fH19fX17eXl6e3x8fH19fX17eXl6e3x8fH19fX17eXl6e3x8fH19fX17eXl6e3x8fH19fX17eXl6e3x8e319fX17eXl6e3x7e319fX17eXl6e3t7e319fX17eXl6e3t7e319fX17eXl6e3t7e319fX17eXl6e3t7e319fX17eXl6e3t7e319fX17eXl6e3p7ent9fX17eXl6e3p6ent9fX17eXl6enp6enp7fX17eXl6enp6enp6e317eXl6enp6enp6ent9e3l5enp6enp6ent7fXt5eXp6enp6ent7e317eXl6enp6ent7e317eXl6enp6ent7e317eXl6enp6ent7e317eXl6enp6ent7e3t9fX17eXl6enp6ent7fX19fX17eXl6enp6e319fX19fX17eXl6enp7fX19fX19e3l5enp7fX19fX19e3l5ent9fX19fX17eXl6e319fX19fX17eXl6e319fH19fX17eXl6e318fH19fX17eXl6e3x8fH19fX17eXl6e3x8fH19fX17eXl6e3x8fH19fX17eXl6e3x8fH19fX17eXl6e3x8e319fX17eXl6e3x7e319fX17eXl6e3t7e319fX17eXl6e3t7e319fX17eXl6e3t7e319fX17eXl6e3t7e319fX17eXl6e3t7e319fX17eXl6e3p7ent9fX17eXl6e3p6ent9fX17eXl6enp6enp7fX17eXl6enp6enp6e317eXl6enp6enp6ent9e3l5enp6enp6ent7fXt5eXp6enp6ent7e317eXl6enp6ent7e317eXl6enp6ent7e317eXl6enp6ent7e3t9fX17eXl6enp6ent7fX19fX17eXl6enp6e319fX19fX17eXl6enp7fX19fX19e3l5enp7fX19fX19e3l5ent9fX19fX17eXl6e319" type="audio/wav" />
        </audio>
      </CardContent>
    </Card>
  );
}

/* ─── Helpers ─── */

function loadState(): PomodoroState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as PomodoroState;
    // If it was completed more than 5 min ago, discard
    if (s.completed) return null;
    // If more than 4 hours have passed, discard (stale session)
    const elapsed = Date.now() - s.startedAt;
    if (elapsed > 4 * 60 * 60_000) return null;
    return s;
  } catch { return null; }
}

function saveState(state: PomodoroState | null) {
  if (!state) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function fmtCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtEst(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

function playAlarm() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(830, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
    // Second chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.3);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.1);
    osc2.start(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 1.1);
  } catch { /* AudioContext not available */ }
}
