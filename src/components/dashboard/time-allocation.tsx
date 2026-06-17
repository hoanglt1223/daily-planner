import { useEffect, useMemo, useState } from 'react';
import { PieChart } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { startOfWeek, addDays } from '@/lib/time-utils';

type Block = { taskId: string | null; title: string; startAt: string; endAt: string; status: string };
type Task = { id: string; categoryId: string | null };
type Category = { id: string; name: string; color: string };

export function TimeAllocation() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 7);
    Promise.all([
      apiFetch<Block[]>(`/api/time-blocks?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`),
      apiFetch<Task[]>('/api/tasks'),
      apiFetch<Category[]>('/api/categories'),
    ])
      .then(([b, t, c]) => { setBlocks(b); setTasks(t); setCategories(c); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const alloc = useMemo(() => computeAllocation(blocks, tasks, categories), [blocks, tasks, categories]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (alloc.total === 0) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-1.5">
          <PieChart className="size-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Time allocation this week</span>
        </div>

        {/* Stacked bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          {alloc.entries.map(e => (
            <div
              key={e.key}
              className="h-full transition-all"
              style={{ width: `${e.pct}%`, backgroundColor: e.color }}
              title={`${e.label}: ${fmtHm(e.minutes)} (${e.pct}%)`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {alloc.entries.map(e => (
            <div key={e.key} className="flex items-center gap-2 min-w-0">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: e.color }} />
              <span className="text-xs truncate">{e.label}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground shrink-0">
                {fmtHm(e.minutes)} <span className="text-[10px]">({e.pct}%)</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface AllocEntry {
  key: string;
  label: string;
  color: string;
  minutes: number;
  pct: number;
}

function computeAllocation(
  blocks: Block[],
  tasks: Task[],
  categories: Category[],
): { entries: AllocEntry[]; total: number } {
  const catMap = new Map<string, Category>();
  categories.forEach(c => catMap.set(c.id, c));

  const taskCatMap = new Map<string, string | null>();
  tasks.forEach(t => taskCatMap.set(t.id, t.categoryId));

  // Aggregate minutes by category key
  const mins = new Map<string, number>();
  let uncategorizedMin = 0;

  for (const b of blocks) {
    const dur = Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000);
    if (dur <= 0) continue;

    const catId = b.taskId ? taskCatMap.get(b.taskId) ?? null : null;
    if (catId) {
      mins.set(catId, (mins.get(catId) ?? 0) + dur);
    } else {
      uncategorizedMin += dur;
    }
  }

  const total = [...mins.values()].reduce((s, v) => s + v, 0) + uncategorizedMin;
  if (total === 0) return { entries: [], total: 0 };

  const entries: AllocEntry[] = [];
  for (const [catId, minutes] of mins) {
    const cat = catMap.get(catId);
    entries.push({
      key: catId,
      label: cat?.name ?? 'Unknown',
      color: cat?.color ?? '#94a3b8',
      minutes,
      pct: Math.round((minutes / total) * 100),
    });
  }

  if (uncategorizedMin > 0) {
    entries.push({
      key: 'uncategorized',
      label: 'Uncategorized',
      color: '#cbd5e1',
      minutes: uncategorizedMin,
      pct: Math.round((uncategorizedMin / total) * 100),
    });
  }

  // Sort by minutes descending
  entries.sort((a, b) => b.minutes - a.minutes);

  return { entries, total };
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}
