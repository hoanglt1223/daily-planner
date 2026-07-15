import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, TrendingUp, Clock, Target, AlertCircle, Lightbulb, Zap, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FactorScores {
  urgency: number;
  importance: number;
  dependencies: number;
  effort: number;
  age: number;
  energy: number;
}

interface PrioritizedTask {
  taskId: string;
  title: string;
  score: number;
  factors: FactorScores;
  reasoning: string[];
}

interface PrioritizationResponse {
  tasks: PrioritizedTask[];
  meta: {
    totalActive: number;
    remainingMinutes: number;
    workDayMinutes: number;
  };
}

export function SmartPrioritization() {
  const [data, setData] = useState<PrioritizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadPriorities = () => {
    setLoading(true);
    setError(false);
    apiFetch<PrioritizationResponse>('/api/prioritization')
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPriorities();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="size-4" />
            Smart Task Prioritization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="size-4" />
            Smart Task Prioritization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 py-2">
            <p className="text-sm text-muted-foreground">Couldn't load priorities</p>
            <Button size="sm" variant="outline" onClick={loadPriorities} className="gap-1">
              <RefreshCw className="size-3" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="size-4" />
            Smart Task Prioritization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Lightbulb className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {data?.meta.totalActive === 0
                ? 'No active tasks to prioritize. Create tasks to see smart recommendations.'
                : 'No prioritization data available.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topTask = data.tasks[0];
  const remainingTasks = data.tasks.slice(1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="size-4" />
            Smart Task Prioritization
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadPriorities}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className="size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Priority Task - Highlighted */}
        {topTask && (
          <div className="relative rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  Top Priority
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="size-3" />
                  <span className="font-medium">{topTask.score}</span>
                  <span>/ 100</span>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1">
                <Link to={`/tasks?focus=${topTask.taskId}`}>
                  Focus
                  <Zap className="size-3" />
                </Link>
              </Button>
            </div>

            <h3 className="font-semibold text-sm mb-2">{topTask.title}</h3>

            <div className="space-y-1.5">
              {topTask.reasoning.slice(0, 3).map((reason, idx) => (
                <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="shrink-0">{reason.split(' ')[0]}</span>
                  <span>{reason.slice(reason.indexOf(' ') + 1)}</span>
                </div>
              ))}
            </div>

            <ScoreBars factors={topTask.factors} compact />
          </div>
        )}

        {/* Remaining Tasks */}
        {remainingTasks.length > 0 && (
          <div className="space-y-2">
            {remainingTasks.map((task, idx) => (
              <div
                key={task.taskId}
                className="rounded-md border border-border/50 p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      #{idx + 2}
                    </span>
                    <h4 className="text-sm font-medium flex-1">{task.title}</h4>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="font-medium">{task.score}</span>
                    <span>/ 100</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {task.reasoning.slice(0, 2).map((reason, rIdx) => (
                    <Badge key={rIdx} variant="outline" className="text-xs py-0 px-1.5 h-5">
                      {reason.split(' ')[0]} {reason.slice(reason.indexOf(' ') + 1, reason.indexOf(' ') + 15)}
                      {reason.length > 20 && '...'}
                    </Badge>
                  ))}
                </div>

                <ScoreBars factors={task.factors} compact />
              </div>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{data.meta.totalActive} active tasks analyzed</span>
          <span>
            {Math.floor(data.meta.remainingMinutes / 60)}h remaining today
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBars({ factors, compact }: { factors: FactorScores; compact?: boolean }) {
  const factorConfigs = [
    { key: 'urgency' as const, label: 'Urgency', icon: AlertCircle, color: 'red' as const },
    { key: 'importance' as const, label: 'Importance', icon: Target, color: 'blue' as const },
    { key: 'effort' as const, label: 'Effort Fit', icon: Clock, color: 'green' as const },
  ];

  return (
    <div className={cn('flex gap-2', compact ? 'mt-2' : 'mt-3')}>
      {factorConfigs.map(({ key, label, icon: Icon, color }) => {
        const score = factors[key];
        const colorClass =
          color === 'red' ? 'bg-red-500' :
          color === 'blue' ? 'bg-blue-500' :
          'bg-green-500';

        return (
          <div key={key} className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Icon className="size-2.5" />
                {label}
              </span>
              <span className="font-medium">{score}</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all', colorClass)}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}