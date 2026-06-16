import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Coffee, Focus, Hourglass, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { blockColor } from '@/lib/block-color';
import { fmtHour, startOfDay, addDays } from '@/lib/time-utils';

type Block = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  taskId: string | null;
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority: number;
  dueDate: string | null;
  estimatedMinutes: number;
};

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Normal',
  4: 'Low',
  5: 'Someday',
};

/** Synthesizes current focus context: now/next block, attention item, capacity. */
export function DailyFocus() {
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

  const focus = useMemo(() => computeFocus(blocks, tasks), [blocks, tasks]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ring-1 ring-primary/20">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-1.5">
          <Focus className="size-4 text-primary" />
          <p className="text-sm font-semibold">Daily focus</p>
        </div>

        {/* Current block */}
        {focus.now ? (
          <div className={cn(
            'rounded-lg border-l-3 px-3 py-2.5 space-y-1',
            focus.now.color.bg,
            focus.now.color.border,
          )}>
            <div className="flex items-center gap-1.5">
              <Zap className="size-3.5 text-amber-500" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Working on now
              </span>
            </div>
            <p className={cn('text-sm font-semibold', focus.now.color.fg)}>
              {focus.now.title}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {fmtHour(new Date(focus.now.startAt))} – {fmtHour(new Date(focus.now.endAt))}
            </p>
          </div>
        ) : focus.next ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <Coffee className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Up next
              </span>
            </div>
            <p className="text-sm font-medium">{focus.next.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {fmtHour(new Date(focus.next.startAt))} – {fmtHour(new Date(focus.next.endAt))}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2.5 text-center">
            <Coffee className="mx-auto size-5 text-muted-foreground/50 mb-1" />
            <p className="text-xs text-muted-foreground">No blocks scheduled today</p>
          </div>
        )}

        {/* Attention item */}
        {focus.attention && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-amber-700">
                {focus.attention.type === 'overdue' ? 'Overdue — needs attention' : 'Top priority'}
              </p>
              <p className="text-sm font-medium truncate">{focus.attention.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {PRIORITY_LABEL[focus.attention.priority] ?? 'Normal'} · {fmtEst(focus.attention.estimatedMinutes)}
                {focus.attention.dueDate && ` · Due ${fmtShortDate(new Date(focus.attention.dueDate))}`}
              </p>
            </div>
          </div>
        )}

        {/* Capacity line */}
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
          <Hourglass className="size-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{focus.capacityMsg}</p>
        </div>

        {/* Action */}
        <Button size="sm" variant="outline" className="w-full" onClick={() => navigate('/planner')}>
          Open planner
        </Button>
      </CardContent>
    </Card>
  );
}

interface AttentionItem extends Task {
  type: 'overdue' | 'priority';
}

interface FocusData {
  now: (Block & { color: ReturnType<typeof blockColor> }) | null;
  next: Block | null;
  attention: AttentionItem | null;
  capacityMsg: string;
}

function computeFocus(blocks: Block[], tasks: Task[]): FocusData {
  const now = Date.now();

  // Sort blocks by start time
  const sorted = [...blocks].sort((a, b) =>
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Find current block (in_progress or currently within time range)
  let current: Block | null = null;
  let next: Block | null = null;
  for (const b of sorted) {
    const start = new Date(b.startAt).getTime();
    const end = new Date(b.endAt).getTime();
    if (b.status === 'in_progress' || (start <= now && end > now)) {
      current = b;
    } else if (start > now && !next) {
      next = b;
    }
  }

  // Attention: overdue tasks first, then highest priority incomplete
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const incomplete = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  const overdue = incomplete.filter(t => t.dueDate && new Date(t.dueDate) < todayStart);
  const sortedOverdue = overdue.sort((a, b) => a.priority - b.priority);
  const sortedByPriority = incomplete.sort((a, b) => a.priority - b.priority);

  let attention: Task | null = null;
  let attentionType: 'overdue' | 'priority' = 'priority';
  if (sortedOverdue.length > 0) {
    attention = sortedOverdue[0];
    attentionType = 'overdue';
  } else if (sortedByPriority.length > 0 && sortedByPriority[0].priority <= 2) {
    attention = sortedByPriority[0];
  }

  // Capacity
  const completedMin = blocks
    .filter(b => b.status === 'completed')
    .reduce((s, b) => s + Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000), 0);
  const totalMin = blocks.reduce((s, b) => s + Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000), 0);
  const freeMin = Math.max(0, 16 * 60 - totalMin);

  let capacityMsg: string;
  if (blocks.length === 0) {
    capacityMsg = 'No blocks today — your day is wide open.';
  } else if (freeMin === 0) {
    capacityMsg = `Fully booked today. ${fmtHm(completedMin)} completed so far.`;
  } else {
    capacityMsg = `${fmtHm(freeMin)} free today. ${fmtHm(completedMin)} of ${fmtHm(totalMin)} done.`;
  }

  return {
    now: current ? { ...current, color: blockColor(current.taskId || current.title || current.id) } : null,
    next,
    attention: attention ? { ...attention, type: attentionType } as Task & { type: string } : null,
    capacityMsg,
  } as FocusData;
}

function fmtEst(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

function fmtShortDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
