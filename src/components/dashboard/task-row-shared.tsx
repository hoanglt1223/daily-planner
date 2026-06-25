import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2, PlayCircle } from 'lucide-react';

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done' | 'archived';

export type Task = {
  id: string; title: string; description?: string | null;
  status: TaskStatus;
  priority: number; estimatedMinutes: number;
  dueDate?: string | null; categoryId: string | null;
};

export type Category = { id: string; name: string; color: string };

export const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: 'Urgent', cls: 'bg-red-100 text-red-700' },
  2: { label: 'High', cls: 'bg-orange-100 text-orange-700' },
  3: { label: 'Normal', cls: 'bg-muted text-muted-foreground' },
  4: { label: 'Low', cls: 'bg-sky-100 text-sky-700' },
  5: { label: 'Someday', cls: 'bg-muted text-muted-foreground' },
};

export function fmtEst(estimatedMinutes: number): string {
  const h = Math.floor(estimatedMinutes / 60);
  const m = estimatedMinutes % 60;
  return h > 0 ? (m ? `${h}h${m}m` : `${h}h`) : `${m}m`;
}

/** Standard task row for today/upcoming lists. */
export function TaskRow({ task, category, busy, onComplete, onStart, overdue }: {
  task: Task; category?: Category; busy: boolean;
  onComplete: () => void; onStart: () => void; overdue?: boolean;
}) {
  const prio = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL[3];

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-md ring-hairline px-3 py-2 transition-colors',
      overdue ? 'border border-red-200 bg-red-50/50' : 'bg-card',
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
          <span className="text-[10px] text-muted-foreground">{fmtEst(task.estimatedMinutes)}</span>
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
