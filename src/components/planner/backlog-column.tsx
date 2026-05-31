import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Task } from './use-planner-data';
import { DraggableTaskCard, NewTaskDialog, STATUS_META } from './draggable-task-card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Status values available for filtering */
const FILTER_STATUSES = ['all', 'backlog', 'todo', 'doing'] as const;
type FilterStatus = (typeof FILTER_STATUSES)[number];

export function BacklogColumn({ tasks, onNew, onUpdate, onDelete }: {
  tasks: Task[];
  onNew: (title: string, minutes: number) => void;
  onUpdate: (id: string, patch: Partial<Pick<Task, 'status' | 'priority'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  /** Non-archived/non-done tasks, filtered by search + status, sorted by priority then title */
  const visible = useMemo(() => {
    const pool = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
    const q = search.toLowerCase().trim();
    return pool
      .filter(t => filter === 'all' || t.status === filter)
      .filter(t => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
  }, [tasks, search, filter]);

  return (
    <aside className="w-64 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Backlog</h2>
        <NewTaskDialog onCreate={onNew} />
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 pl-7 text-xs"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1">
        {FILTER_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
              filter === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30',
            )}
          >
            {s === 'all' ? 'All' : STATUS_META[s].label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {visible.map(t => (
          <DraggableTaskCard key={t.id} task={t} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {search || filter !== 'all' ? 'No matching tasks.' : 'No tasks. Click + New.'}
          </p>
        )}
      </div>
    </aside>
  );
}
