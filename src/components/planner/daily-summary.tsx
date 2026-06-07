import { useMemo } from 'react';
import { CheckCircle2, Clock, SkipForward, BarChart3 } from 'lucide-react';
import type { TimeBlock, Task, Category } from './use-planner-data';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function DailySummary({ blocks, tasks, categories }: {
  blocks: TimeBlock[];
  tasks: Task[];
  categories: Category[];
}) {
  const stats = useMemo(() => computeStats(blocks, tasks, categories), [blocks, tasks, categories]);

  if (stats.totalMin === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-center">
          <BarChart3 className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No blocks scheduled for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const completionPct = stats.totalMin > 0
    ? Math.round((stats.completedMin / stats.totalMin) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-sm font-medium">Period summary</p>

        {/* Stat chips */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip
            icon={Clock}
            label="Scheduled"
            value={fmtHm(stats.totalMin)}
            tone="slate"
          />
          <StatChip
            icon={CheckCircle2}
            label="Completed"
            value={fmtHm(stats.completedMin)}
            sub={`${completionPct}%`}
            tone="emerald"
          />
          <StatChip
            icon={SkipForward}
            label="Skipped"
            value={fmtHm(stats.skippedMin)}
            tone="zinc"
          />
          <StatChip
            icon={Clock}
            label="Remaining"
            value={fmtHm(stats.remainingMin)}
            tone="amber"
          />
        </div>

        {/* Category breakdown */}
        {stats.catRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Time by category</p>
            <div className="space-y-1.5">
              {stats.catRows.map(row => {
                const pct = stats.totalMin > 0
                  ? Math.min(100, Math.round((row.minutes / stats.totalMin) * 100))
                  : 0;
                return (
                  <div key={row.key} className="flex items-center gap-2 text-xs">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="w-24 truncate text-muted-foreground">{row.label}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: row.color }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums text-muted-foreground">{fmtHm(row.minutes)}</span>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatChip({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: 'slate' | 'emerald' | 'amber' | 'zinc';
}) {
  const tones = {
    slate:   { bg: 'bg-slate-50',   icon: 'text-slate-600',   ring: 'ring-slate-200' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-200' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   ring: 'ring-amber-200' },
    zinc:    { bg: 'bg-zinc-50',    icon: 'text-zinc-600',    ring: 'ring-zinc-200' },
  }[tone];

  return (
    <div className={cn('rounded-lg border p-3 ring-1', tones.ring)}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={cn('rounded p-1', tones.bg)}>
          <Icon className={cn('size-3', tones.icon)} />
        </div>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

interface CatRow {
  key: string;
  label: string;
  color: string;
  minutes: number;
}

interface Stats {
  totalMin: number;
  completedMin: number;
  skippedMin: number;
  remainingMin: number;
  catRows: CatRow[];
}

function computeStats(blocks: TimeBlock[], tasks: Task[], categories: Category[]): Stats {
  const catMap = new Map<string, Category>();
  categories.forEach(c => catMap.set(c.id, c));

  // Map taskId → categoryId
  const taskCatMap = new Map<string, string | null>();
  tasks.forEach(t => taskCatMap.set(t.id, t.categoryId));

  let totalMin = 0;
  let completedMin = 0;
  let skippedMin = 0;

  // Aggregate by category key
  const catMinutes = new Map<string, number>();

  for (const b of blocks) {
    const dur = Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000);
    totalMin += dur;

    if (b.status === 'completed') completedMin += dur;
    else if (b.status === 'skipped') skippedMin += dur;

    // Resolve category
    const catId = b.taskId ? taskCatMap.get(b.taskId) ?? null : null;
    const cat = catId ? catMap.get(catId) : null;
    const key = cat ? cat.id : '__none';
    catMinutes.set(key, (catMinutes.get(key) ?? 0) + dur);
  }

  const remainingMin = Math.max(0, totalMin - completedMin - skippedMin);

  // Build sorted category rows
  const catRows: CatRow[] = [];
  for (const [key, minutes] of catMinutes) {
    if (key === '__none') {
      catRows.push({ key, label: 'Uncategorized', color: '#94a3b8', minutes });
    } else {
      const cat = catMap.get(key)!;
      catRows.push({ key, label: cat.name, color: cat.color, minutes });
    }
  }
  catRows.sort((a, b) => b.minutes - a.minutes);

  return { totalMin, completedMin, skippedMin, remainingMin, catRows };
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}
