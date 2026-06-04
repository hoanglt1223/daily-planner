import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, PlayCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Task = {
  id: string; title: string; description: string | null;
  status: 'backlog' | 'todo' | 'doing' | 'done' | 'archived';
  priority: number; estimatedMinutes: number;
  dueDate: string | null; categoryId: string | null;
};

type Category = { id: string; name: string; color: string };

const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: 'Urgent', cls: 'bg-red-100 text-red-700' },
  2: { label: 'High', cls: 'bg-orange-100 text-orange-700' },
  3: { label: 'Normal', cls: 'bg-muted text-muted-foreground' },
  4: { label: 'Low', cls: 'bg-sky-100 text-sky-700' },
  5: { label: 'Someday', cls: 'bg-muted text-muted-foreground' },
};

export function TodayTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allTasks, cats] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Category[]>('/api/categories'),
      ]);
      setCategories(cats);
      // Filter to overdue + today, exclude done/archived
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      setTasks(allTasks.filter(t =>
        t.status !== 'done' && t.status !== 'archived' && t.dueDate &&
        new Date(t.dueDate) <= todayEnd
      ));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const { overdue, dueToday } = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const overdue: Task[] = [];
    const dueToday: Task[] = [];
    for (const t of tasks) {
      const due = new Date(t.dueDate!);
      if (due < todayStart) overdue.push(t);
      else dueToday.push(t);
    }
    const sort = (a: Task, b: Task) => a.priority - b.priority || a.title.localeCompare(b.title);
    return { overdue: overdue.sort(sort), dueToday: dueToday.sort(sort) };
  }, [tasks]);

  async function updateStatus(id: string, status: Task['status']) {
    setBusyId(id);
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (status === 'done' || status === 'archived') {
        setTasks(prev => prev.filter(t => t.id !== id));
      } else {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      }
      toast.success(status === 'done' ? 'Task completed!' : 'Status updated');
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading tasks…
        </CardContent>
      </Card>
    );
  }

  if (overdue.length === 0 && dueToday.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-500" />
          <p className="text-sm font-medium">All clear!</p>
          <p className="text-xs text-muted-foreground">No tasks due today or overdue.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-sm font-medium">Today's tasks</p>

        {overdue.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-600">
              <AlertTriangle className="size-3.5" />
              Overdue ({overdue.length})
            </div>
            {overdue.map(t => (
              <TaskRow key={t.id} task={t} category={t.categoryId ? catMap.get(t.categoryId) : undefined}
                busy={busyId === t.id} onComplete={() => updateStatus(t.id, 'done')}
                onStart={() => updateStatus(t.id, 'doing')} overdue />
            ))}
          </div>
        )}

        {dueToday.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <CalendarClock className="size-3.5" />
              Due today ({dueToday.length})
            </div>
            {dueToday.map(t => (
              <TaskRow key={t.id} task={t} category={t.categoryId ? catMap.get(t.categoryId) : undefined}
                busy={busyId === t.id} onComplete={() => updateStatus(t.id, 'done')}
                onStart={() => updateStatus(t.id, 'doing')} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, category, busy, onComplete, onStart, overdue }: {
  task: Task; category?: Category; busy: boolean;
  onComplete: () => void; onStart: () => void; overdue?: boolean;
}) {
  const prio = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL[3];
  const estH = Math.floor(task.estimatedMinutes / 60);
  const estM = task.estimatedMinutes % 60;
  const estStr = estH > 0 ? (estM ? `${estH}h${estM}m` : `${estH}h`) : `${estM}m`;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-md border px-3 py-2 transition-colors',
      overdue ? 'border-red-200 bg-red-50/50' : 'bg-card',
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{task.title}</span>
          {category && (
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} title={category.name} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', prio.cls)}>
            {prio.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{estStr}</span>
          {task.status === 'doing' && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700">In progress</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {task.status !== 'doing' && (
          <Button size="icon" variant="ghost" className="size-7" title="Start working"
            disabled={busy} onClick={onStart}>
            <PlayCircle className="size-4 text-blue-600" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="size-7" title="Mark done"
          disabled={busy} onClick={onComplete}>
          <CheckCircle2 className="size-4 text-emerald-600" />
        </Button>
      </div>
    </div>
  );
}
