import { useCallback, useEffect, useState } from 'react';
import { Link2, X, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
}

interface TaskDependencySelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  excludeTaskId?: string; // Exclude current task from selection when editing
  label?: string;
}

export function TaskDependencySelector({
  value,
  onChange,
  excludeTaskId,
  label = 'Blocked by (dependencies)',
}: TaskDependencySelectorProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Load available tasks
  useEffect(() => {
    setLoading(true);
    apiFetch<Task[]>('/api/tasks')
      .then(t => {
        // Exclude archived, done tasks, and current task
        const available = t.filter(
          task => task.status !== 'done' &&
                   task.status !== 'archived' &&
                   task.id !== excludeTaskId
        );
        setTasks(available);
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [excludeTaskId]);

  const handleToggle = useCallback((taskId: string) => {
    if (value.includes(taskId)) {
      onChange(value.filter(id => id !== taskId));
    } else {
      onChange([...value, taskId]);
    }
  }, [value, onChange]);

  const handleRemove = useCallback((taskId: string) => {
    onChange(value.filter(id => id !== taskId));
  }, [value, onChange]);

  // Get selected task details for badges
  const selectedTasks = tasks.filter(t => value.includes(t.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {selectedTasks.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selectedTasks.length} blocking
          </Badge>
        )}
      </div>

      {/* Selected tasks as badges */}
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTasks.map(task => (
            <Badge
              key={task.id}
              variant="outline"
              className="gap-1 pr-1.5 text-xs"
            >
              <Link2 className="size-3" />
              <span className="max-w-[150px] truncate">{task.title}</span>
              <button
                type="button"
                onClick={() => handleRemove(task.id)}
                className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Expandable task selector */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
          'hover:bg-muted/50 border-border',
          expanded && 'bg-muted/50'
        )}
      >
        <span className="text-muted-foreground">
          {value.length === 0 ? 'Add blocking tasks…' : `${value.length} blocking task${value.length > 1 ? 's' : ''} selected`}
        </span>
      </button>

      {expanded && (
        <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
          {loading ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              Loading tasks…
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              No available tasks
            </div>
          ) : (
            tasks.map(task => (
              <button
                key={task.id}
                type="button"
                onClick={() => handleToggle(task.id)}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1.5 w-full text-left',
                  'hover:bg-muted/50 transition-colors',
                  value.includes(task.id) && 'bg-muted'
                )}
              >
                <div className={cn(
                  'size-4 rounded border flex items-center justify-center shrink-0',
                  value.includes(task.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                )}>
                  {value.includes(task.id) && <Check className="size-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{task.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{task.status}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
