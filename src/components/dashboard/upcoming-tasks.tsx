import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Loader2, PlayCircle } from 'lucide-react';
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

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function UpcomingTasks() {
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
      // Filter to tasks due tomorrow through +7 days, exclude done/archived
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const horizon = new Date(todayStart); horizon.setDate(horizon.getDate() + 7);
      setTasks(allTasks.filter(t =>
        t.status !== 'done' && t.status !== 'archived' && t.dueDate &&
        new Date(t.dueDate) > todayStart && new Date(t.dueDate) < horizon
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

  const grouped = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
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

function TaskRow({ task, category, busy, onComplete, onStart }: {
  task: Task; category?: Category; busy: boolean;
  onComplete: () => void; onStart: () => void;
}) {
  const prio = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL[3];
  const estH = Math.floor(task.estimatedMinutes / 60);
  const estM = task.estimatedMinutes % 60;
  const estStr = estH > 0 ? (estM ? `${estH}h${estM}m` : `${estH}h`) : `${estM}m`;

  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 transition-colors">
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
