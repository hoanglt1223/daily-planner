import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TaskRow } from './task-row-shared';
import type { Task, Category } from './task-row-shared';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function UpcomingTasks() {
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
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const horizon = new Date(todayStart); horizon.setDate(horizon.getDate() + 7);
      setTasks(allTasks.filter(t =>
        t.status !== 'done' && t.status !== 'archived' && t.dueDate &&
        new Date(t.dueDate) > todayStart && new Date(t.dueDate) < horizon
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

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    const sorted = [...tasks].sort((a, b) => {
      const da = new Date(a.dueDate!).getTime();
      const db = new Date(b.dueDate!).getTime();
      if (da !== db) return da - db;
      return a.priority - b.priority || a.title.localeCompare(b.title);
    });
    for (const t of sorted) {
      const d = new Date(t.dueDate!);
      const dayKey = d.toISOString().slice(0, 10);
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(t);
    }
    return map;
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
          <Loader2 className="size-4 animate-spin" /> Loading upcoming…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-5 text-center space-y-2">
          <p className="text-sm text-destructive">Failed to load upcoming tasks.</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (grouped.size === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-center">
          <CalendarDays className="mx-auto mb-2 size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nothing upcoming</p>
          <p className="text-xs text-muted-foreground">No tasks due in the next 7 days (beyond today).</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-sm font-medium">Upcoming (next 7 days)</p>

        {Array.from(grouped.entries()).map(([dayKey, dayTasks]) => {
          const d = new Date(dayKey + 'T00:00:00');
          const dayName = SHORT_DAYS[d.getDay()];
          const label = `${dayName} ${d.getDate()}/${d.getMonth() + 1}`;
          return (
            <div key={dayKey} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              {dayTasks.map(t => (
                <TaskRow key={t.id} task={t} category={t.categoryId ? catMap.get(t.categoryId) : undefined}
                  busy={busyId === t.id} onComplete={() => updateStatus(t.id, 'done')}
                  onStart={() => updateStatus(t.id, 'doing')} />
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
