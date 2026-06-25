import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Trophy } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PRIORITY_LABEL, fmtEst } from './task-row-shared';
import type { Category } from './task-row-shared';

type CompletedTask = {
  id: string; title: string;
  status: 'backlog' | 'todo' | 'doing' | 'done' | 'archived';
  priority: number; estimatedMinutes: number;
  updatedAt: string; categoryId: string | null;
};

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Shows tasks completed in the last 7 days, grouped by day, with ability to reopen. */
export function CompletedTasks() {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [allTasks, cats] = await Promise.all([
        apiFetch<CompletedTask[]>('/api/tasks'),
        apiFetch<Category[]>('/api/categories'),
      ]);
      setCategories(cats);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      setTasks(allTasks.filter(t =>
        t.status === 'done' && new Date(t.updatedAt) >= cutoff
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
    const map = new Map<string, CompletedTask[]>();
    const sorted = [...tasks].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    for (const t of sorted) {
      const d = new Date(t.updatedAt);
      const dayKey = d.toISOString().slice(0, 10);
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(t);
    }
    return map;
  }, [tasks]);

  const totalCount = tasks.length;

  async function reopenTask(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'todo' }),
      });
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Task reopened');
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading completed…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-5 text-center space-y-2">
          <p className="text-sm text-destructive">Failed to load completed tasks.</p>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-center">
          <Trophy className="mx-auto mb-2 size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">No recent completions</p>
          <p className="text-xs text-muted-foreground">Tasks you complete will appear here for 7 days.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Recently completed</p>
          <Badge variant="secondary" className="text-[10px]">
            {totalCount} task{totalCount !== 1 ? 's' : ''}
          </Badge>
        </div>

        {Array.from(grouped.entries()).map(([dayKey, dayTasks]) => {
          const d = new Date(dayKey + 'T00:00:00');
          const dayName = SHORT_DAYS[d.getDay()];
          const label = `${dayName} ${d.getDate()}/${d.getMonth() + 1}`;
          const isToday = dayKey === new Date().toISOString().slice(0, 10);
          return (
            <div key={dayKey} className="space-y-1.5">
              <p className={cn(
                'text-xs font-medium',
                isToday ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {isToday ? 'Today' : label}
              </p>
              {dayTasks.map(t => (
                <CompletedRow
                  key={t.id}
                  task={t}
                  category={t.categoryId ? catMap.get(t.categoryId) : undefined}
                  busy={busyId === t.id}
                  onReopen={() => reopenTask(t.id)}
                />
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CompletedRow({ task, category, busy, onReopen }: {
  task: CompletedTask; category?: Category; busy: boolean; onReopen: () => void;
}) {
  const prio = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL[3];

  return (
    <div className="flex items-center gap-2 rounded-md ring-hairline bg-card px-3 py-2 transition-colors opacity-80 hover:opacity-100">
      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm truncate line-through text-muted-foreground">{task.title}</span>
          {category && (
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} title={category.name} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', prio.cls)}>
            {prio.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{fmtEst(task.estimatedMinutes)}</span>
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        title="Reopen task"
        disabled={busy}
        onClick={onReopen}
      >
        <RotateCcw className="size-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}
