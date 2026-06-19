import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  PenLine,
  Sparkles,
  Target,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { startOfDay, addDays, fmtIsoDate } from '@/lib/time-utils';

type Block = {
  id: string;
  taskId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority: number;
  estimatedMinutes: number;
  dueDate: string | null;
};

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Normal',
  4: 'Low',
  5: 'Someday',
};

/** End-of-day review: completed vs planned, actual vs scheduled time, estimation accuracy. */
export function DailyReview() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = addDays(todayStart, 1);
    Promise.all([
      apiFetch<Block[]>(`/api/time-blocks?from=${todayStart.toISOString()}&to=${todayEnd.toISOString()}`),
      apiFetch<Task[]>('/api/tasks'),
    ])
      .then(([b, t]) => { setBlocks(b); setTasks(t); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const review = useMemo(() => computeReview(blocks, tasks), [blocks, tasks]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="size-4 text-primary" />
          <p className="text-sm font-semibold">Daily review</p>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {fmtIsoDate(new Date())}
          </span>
        </div>

        {/* Metric row */}
        <div className="grid grid-cols-3 gap-2">
          <MetricPill
            icon={CheckCircle2}
            label="Done"
            value={`${review.completedCount}`}
            sub={`of ${review.totalPlanned} planned`}
            tone={review.completionRate >= 80 ? 'emerald' : review.completionRate >= 50 ? 'amber' : 'slate'}
          />
          <MetricPill
            icon={Clock}
            label="Actual"
            value={fmtHm(review.actualMinutes)}
            sub={`${fmtHm(review.scheduledMinutes)} scheduled`}
            tone={review.actualMinutes <= review.scheduledMinutes ? 'emerald' : 'amber'}
          />
          <MetricPill
            icon={Target}
            label="Accuracy"
            value={review.estimationAccuracy !== null ? `${review.estimationAccuracy}%` : '—'}
            sub={review.estimationAccuracy !== null ? 'est vs actual' : 'no data'}
            tone={review.estimationAccuracy !== null && review.estimationAccuracy >= 80 ? 'emerald' : 'amber'}
          />
        </div>

        {/* Completed tasks list */}
        {review.completedTasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Completed today
            </p>
            {review.completedTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
                <span className="truncate">{t.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                  {PRIORITY_LABEL[t.priority] ?? 'Normal'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Unplanned completed */}
        {review.unplannedCompleted > 0 && (
          <p className="text-[10px] text-muted-foreground">
            + {review.unplannedCompleted} task{review.unplannedCompleted !== 1 ? 's' : ''} completed without a time block
          </p>
        )}

        {/* Message */}
        <div className={cn(
          'rounded-md px-3 py-2 text-xs',
          review.tone === 'great' && 'bg-emerald-50 border border-emerald-200 text-emerald-700',
          review.tone === 'good' && 'bg-sky-50 border border-sky-200 text-sky-700',
          review.tone === 'low' && 'bg-amber-50 border border-amber-200 text-amber-700',
          review.tone === 'none' && 'bg-muted/50 text-muted-foreground',
        )}>
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3 shrink-0" />
            {review.message}
          </div>
        </div>

        {/* Reflect action */}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => {
            navigate('/dashboard');
            // Scroll to daily notes after a tick
            setTimeout(() => {
              document.querySelector('[data-daily-notes]')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
        >
          <PenLine className="size-3.5 mr-1.5" />
          Reflect on today
        </Button>
      </CardContent>
    </Card>
  );
}

interface ReviewData {
  completedCount: number;
  totalPlanned: number;
  completionRate: number;
  actualMinutes: number;
  scheduledMinutes: number;
  estimationAccuracy: number | null;
  completedTasks: Task[];
  unplannedCompleted: number;
  tone: 'great' | 'good' | 'low' | 'none';
  message: string;
}

function computeReview(blocks: Block[], tasks: Task[]): ReviewData {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);

  // Today's blocks
  const todayBlocks = blocks.filter(b => {
    const start = new Date(b.startAt);
    return start >= todayStart && start < todayEnd;
  });

  // Scheduled and actual time
  const scheduledMinutes = todayBlocks.reduce(
    (s, b) => s + Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000), 0
  );
  const completedBlocks = todayBlocks.filter(b => b.status === 'completed');
  const actualMinutes = completedBlocks.reduce(
    (s, b) => s + Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000), 0
  );

  // Tasks that were due today
  const dueToday = tasks.filter(t => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= todayStart && due < todayEnd;
  });

  const completedDueToday = dueToday.filter(t => t.status === 'done');

  // Tasks completed that have blocks today (linked via taskId)
  const blockedTaskIds = new Set(todayBlocks.map(b => b.taskId).filter(Boolean));
  const completedWithBlocks = completedDueToday.filter(t => blockedTaskIds.has(t.id));
  const completedWithoutBlocks = completedDueToday.filter(t => !blockedTaskIds.has(t.id));

  // Estimation accuracy: sum of estimatedMinutes for tasks with completed blocks vs actual block minutes
  const totalEstimated = completedWithBlocks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const estimationAccuracy = totalEstimated > 0 && actualMinutes > 0
    ? Math.min(100, Math.round((Math.min(totalEstimated, actualMinutes) / Math.max(totalEstimated, actualMinutes)) * 100))
    : null;

  // If no tasks were due today, fall back to block counts
  const totalPlanned = dueToday.length;
  const completedCount = completedDueToday.length;
  const effectiveCompletedCount = totalPlanned > 0 ? completedCount : completedBlocks.length;
  const effectiveTotalPlanned = totalPlanned > 0 ? totalPlanned : todayBlocks.length;
  const effectiveRate = effectiveTotalPlanned > 0 ? Math.round((effectiveCompletedCount / effectiveTotalPlanned) * 100) : 0;

  // Tone and message
  let tone: ReviewData['tone'] = 'none';
  let message: string;

  if (todayBlocks.length === 0 && completedDueToday.length === 0) {
    tone = 'none';
    message = 'No activity recorded today. Time for a fresh start tomorrow!';
  } else if (effectiveRate >= 80) {
    tone = 'great';
    message = `Crushing it! ${effectiveCompletedCount} tasks done. Keep the momentum going.`;
  } else if (effectiveRate >= 50) {
    tone = 'good';
    message = `Solid progress — ${effectiveCompletedCount} of ${effectiveTotalPlanned} tasks completed.`;
  } else if (effectiveRate > 0) {
    tone = 'low';
    message = `Some progress today. Focus on the remaining ${effectiveTotalPlanned - effectiveCompletedCount} task${(effectiveTotalPlanned - effectiveCompletedCount) !== 1 ? 's' : ''} tomorrow.`;
  } else if (todayBlocks.length > 0) {
    tone = 'low';
    message = `${todayBlocks.length} block${todayBlocks.length !== 1 ? 's' : ''} scheduled but none completed yet. You've got this!`;
  } else {
    tone = 'none';
    message = 'Plan your day ahead to stay on track.';
  }

  return {
    completedCount: effectiveCompletedCount,
    totalPlanned: effectiveTotalPlanned,
    completionRate: effectiveRate,
    actualMinutes,
    scheduledMinutes,
    estimationAccuracy,
    completedTasks: completedDueToday,
    unplannedCompleted: completedWithoutBlocks.length,
    tone,
    message,
  };
}

function MetricPill({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone: 'emerald' | 'amber' | 'slate';
}) {
  const tones = {
    emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    amber:   { ring: 'ring-amber-200',   bg: 'bg-amber-50',   icon: 'text-amber-600' },
    slate:   { ring: 'ring-slate-200',   bg: 'bg-slate-50',   icon: 'text-slate-500' },
  }[tone];

  return (
    <div className={cn('rounded-lg border p-2.5 ring-1 text-center', tones.ring, tones.bg)}>
      <Icon className={cn('size-3.5 mx-auto mb-1', tones.icon)} />
      <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
      <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
      <p className="text-[9px] text-muted-foreground/70 leading-tight mt-0.5">{sub}</p>
    </div>
  );
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}
