import { useMemo } from 'react';
import { Link2, AlertCircle, CheckCircle2, Clock, PlayCircle, Archive } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  blockedByTaskIds: string[];
  dueDate: string | null;
}

interface DependencyListProps {
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

export function DependencyList({ tasks, onTaskClick }: DependencyListProps) {
  // Filter tasks with dependencies
  const tasksWithDeps = useMemo(() => {
    return tasks.filter(t => t.blockedByTaskIds && t.blockedByTaskIds.length > 0);
  }, [tasks]);

  // Calculate blocking info for each task
  const blockingInfo = useMemo(() => {
    const info = new Map<string, { blockedBy: Task[], blocking: Task[] }>();

    tasks.forEach(task => {
      const blockedBy: Task[] = [];
      const blocking: Task[] = [];

      // Find tasks that block this task
      if (task.blockedByTaskIds) {
        task.blockedByTaskIds.forEach(blockerId => {
          const blocker = tasks.find(t => t.id === blockerId);
          if (blocker) blockedBy.push(blocker);
        });
      }

      // Find tasks that are blocked by this task
      tasks.forEach(other => {
        if (other.blockedByTaskIds && other.blockedByTaskIds.includes(task.id)) {
          blocking.push(other);
        }
      });

      info.set(task.id, { blockedBy, blocking });
    });

    return info;
  }, [tasks]);

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="size-3.5 text-emerald-500" />;
      case 'doing': return <PlayCircle className="size-3.5 text-amber-500" />;
      case 'backlog': return <Archive className="size-3.5 text-slate-500" />;
      case 'archived': return <Archive className="size-3.5 text-slate-400" />;
      default: return <Clock className="size-3.5 text-blue-500" />;
    }
  };

  // Get priority color
  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'text-red-600';
      case 2: return 'text-orange-600';
      case 4: return 'text-sky-600';
      case 5: return 'text-slate-500';
      default: return 'text-muted-foreground';
    }
  };

  if (tasksWithDeps.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Link2 className="size-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium">No task dependencies</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add dependencies to tasks to see them here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasksWithDeps.map(task => {
        const info = blockingInfo.get(task.id);
        if (!info) return null;

        const hasIncompleteBlockers = info.blockedBy.some(t => t.status !== 'done');
        const isBlocked = hasIncompleteBlockers;

        return (
          <Card key={task.id} className={cn(
            'transition-colors hover:bg-muted/50 cursor-pointer',
            isBlocked && 'border-amber-200 bg-amber-50/30'
          )}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {getStatusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        P{task.priority}
                      </Badge>
                      <span className={cn('text-xs font-medium', getPriorityColor(task.priority))}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {isBlocked && (
                    <div className="flex items-center gap-1.5 text-amber-600">
                      <AlertCircle className="size-3.5" />
                      <span className="text-xs font-medium">Blocked</span>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {info.blockedBy.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span>Waiting on:</span>
                        <span className="font-medium">{info.blockedBy.filter(t => t.status !== 'done').length}</span>
                      </div>
                    )}
                    {info.blocking.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span>Blocking:</span>
                        <span className="font-medium">{info.blocking.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Show blocking tasks */}
              {(info.blockedBy.length > 0 || info.blocking.length > 0) && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  {info.blockedBy.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Blocked by:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {info.blockedBy.map(blocker => (
                          <Badge
                            key={blocker.id}
                            variant={blocker.status === 'done' ? 'outline' : 'secondary'}
                            className={cn(
                              'text-xs cursor-pointer hover:opacity-80',
                              blocker.status !== 'done' && 'bg-amber-100 text-amber-700 border-amber-200'
                            )}
                            onClick={() => onTaskClick?.(blocker.id)}
                          >
                            {blocker.status !== 'done' && <AlertCircle className="size-3 mr-1" />}
                            {blocker.title.length > 15 ? blocker.title.substring(0, 15) + '...' : blocker.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {info.blocking.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Blocking:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {info.blocking.map(blocked => (
                          <Badge
                            key={blocked.id}
                            variant="outline"
                            className="text-xs cursor-pointer hover:opacity-80"
                            onClick={() => onTaskClick?.(blocked.id)}
                          >
                            {blocked.title.length > 15 ? blocked.title.substring(0, 15) + '...' : blocked.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}