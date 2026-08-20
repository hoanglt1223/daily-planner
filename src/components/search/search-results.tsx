import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Clock, CheckCircle2, AlertCircle, Calendar, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface SearchResultsProps {
  query: string;
  filters: {
    status: string;
    priority: string;
    category: string;
    dateFrom: string;
    dateTo: string;
    includeCompleted: boolean;
    includeTimeBlocks: boolean;
    includeTasks: boolean;
  };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  estimatedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TimeBlock {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  taskId: string | null;
  task?: Task;
  notes: string | null;
}

export function SearchResults({ query, filters }: SearchResultsProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await Promise.allSettled([
          filters.includeTasks ? apiFetch<Task[]>(`/api/tasks`) : Promise.resolve([]),
          filters.includeTimeBlocks ? apiFetch<TimeBlock[]>(`/api/time-blocks?from=${filters.dateFrom || '2000-01-01'}&to=${filters.dateTo || '2100-01-01'}`) : Promise.resolve([]),
        ]);

        const tasksResult = results[0];
        const blocksResult = results[1];

        let filteredTasks: Task[] = [];
        let filteredBlocks: TimeBlock[] = [];

        if (tasksResult.status === 'fulfilled') {
          filteredTasks = tasksResult.value.filter(task => {
            const matchesQuery = !query ||
              task.title.toLowerCase().includes(query.toLowerCase()) ||
              (task.description?.toLowerCase().includes(query.toLowerCase()));
            const matchesStatus = !filters.status || task.status === filters.status;
            const matchesPriority = !filters.priority || task.priority === filters.priority;
            const matchesCategory = !filters.category ||
              task.category?.toLowerCase().includes(filters.category.toLowerCase());
            const matchesCompleted = filters.includeCompleted || task.status !== 'completed';

            return matchesQuery && matchesStatus && matchesPriority && matchesCategory && matchesCompleted;
          });
        }

        if (blocksResult.status === 'fulfilled') {
          filteredBlocks = blocksResult.value.filter(block => {
            const matchesQuery = !query ||
              block.notes?.toLowerCase().includes(query.toLowerCase());
            const matchesStatus = !filters.status || block.status === filters.status;
            const matchesCompleted = filters.includeCompleted || block.status !== 'completed';

            return matchesQuery && matchesStatus && matchesCompleted;
          });
        }

        setTasks(filteredTasks);
        setTimeBlocks(filteredBlocks);
      } catch (err) {
        setError('Failed to search. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    search();
  }, [query, filters]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <p className="font-medium">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalResults = tasks.length + timeBlocks.length;

  if (totalResults === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm mt-2">
            Try adjusting your search terms or filters
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Found {totalResults} result{totalResults !== 1 ? 's' : ''}
      </div>

      {tasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Tasks ({tasks.length})</h3>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      {timeBlocks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Time Blocks ({timeBlocks.length})</h3>
          {timeBlocks.map(block => (
            <TimeBlockCard key={block.id} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const priorityColors = {
    critical: 'destructive',
    high: 'destructive',
    medium: 'default',
    low: 'secondary',
  } as const;

  const statusIcons = {
    backlog: <Clock className="size-3" />,
    todo: <AlertCircle className="size-3" />,
    in_progress: <Clock className="size-3" />,
    completed: <CheckCircle2 className="size-3" />,
    cancelled: <AlertCircle className="size-3" />,
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium truncate">{task.title}</h4>
              <Badge variant={priorityColors[task.priority as keyof typeof priorityColors] || 'default'}>
                {task.priority}
              </Badge>
              <Badge variant="outline" className="gap-1">
                {statusIcons[task.status as keyof typeof statusIcons]}
                {task.status}
              </Badge>
            </div>

            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {task.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.category && (
                <span className="flex items-center gap-1">
                  <Tag className="size-3" />
                  {task.category}
                </span>
              )}
              {task.estimatedMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {Math.round(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}m
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TimeBlockCard({ block }: { block: TimeBlock }) {
  const startDate = new Date(block.startAt);
  const endDate = new Date(block.endAt);
  const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium">
                {block.task?.title || 'Time Block'}
              </span>
              <Badge variant="outline">
                {block.status}
              </Badge>
            </div>

            {block.notes && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {block.notes}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {format(startDate, 'MMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
              </span>
              <span>{duration} min</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
