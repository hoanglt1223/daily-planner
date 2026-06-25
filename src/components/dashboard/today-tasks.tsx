import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TaskRow } from './task-row-shared';
import type { Task, Category } from './task-row-shared';

export function TodayTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [allTasks, cats] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Category[]>('/api/categories'),
      ]);
      setCategories(cats);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      setTasks(allTasks.filter(t =>
        t.status !== 'done' && t.status !== 'archived' && t.dueDate &&
        new Date(t.dueDate) <= todayEnd
      ));
    } catch {
      setError(true);
    } finally { setLoading(false); }
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
    return { overdue: [...overdue].sort(sort), dueToday: [...dueToday].sort(sort) };
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

  if (error) {
    return (
      <Card>
        <CardContent className="p-5 text-center space-y-2">
          <p className="text-sm text-destructive">Failed to load tasks.</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
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
            <div className={cn('flex items-center gap-1.5 text-xs font-medium text-foreground')}>
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

