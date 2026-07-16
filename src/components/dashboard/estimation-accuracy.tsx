import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

type EstimationAccuracyTask = {
  taskId: string;
  taskTitle: string;
  estimatedMinutes: number;
  actualMinutes: number;
  accuracyPercent: number;
  varianceMinutes: number;
  completedAt: string;
};

type EstimationAccuracyResponse = {
  from: string;
  to: string;
  overall: {
    totalTasks: number;
    avgAccuracyPercent: number;
    totalEstimatedMinutes: number;
    totalActualMinutes: number;
    overestimatedTasks: number;
    underestimatedTasks: number;
    accurateTasks: number;
  };
  tasks: EstimationAccuracyTask[];
  insights: string[];
};

export function EstimationAccuracy() {
  const [data, setData] = useState<EstimationAccuracyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const from = new Date();
        from.setDate(from.getDate() - 30); // Last 30 days
        const to = new Date();
        to.setDate(to.getDate() + 1);

        const response = await fetch(
          `/api/reports/estimation-accuracy?from=${from.toISOString()}&to=${to.toISOString()}`
        );
        if (!response.ok) throw new Error('Failed to fetch estimation accuracy data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Estimation Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.overall.totalTasks === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Estimation Accuracy</CardTitle>
          <CardDescription>Track how well you estimate task time</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No completed tasks found. Complete some tasks to see your estimation accuracy.
          </p>
        </CardContent>
      </Card>
    );
  }

  const accuracyColor = data.overall.avgAccuracyPercent >= 80
    ? 'text-green-600'
    : data.overall.avgAccuracyPercent >= 60
    ? 'text-yellow-600'
    : 'text-red-600';

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimation Accuracy</CardTitle>
        <CardDescription>
          Last 30 days • {formatDate(data.from)} – {formatDate(data.to)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Overall Accuracy</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${accuracyColor}`}>
                {data.overall.avgAccuracyPercent}%
              </span>
            </div>
            <Progress value={data.overall.avgAccuracyPercent} className="h-2" />
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Tasks Analyzed</p>
            <span className="text-3xl font-bold">{data.overall.totalTasks}</span>
          </div>
        </div>

        {/* Time Comparison */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Estimated</p>
            <p className="text-lg font-semibold">{formatMinutes(data.overall.totalEstimatedMinutes)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Actual</p>
            <p className="text-lg font-semibold">{formatMinutes(data.overall.totalActualMinutes)}</p>
          </div>
        </div>

        {/* Task Distribution */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {data.overall.accurateTasks} Accurate
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {data.overall.overestimatedTasks} Overestimated
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            {data.overall.underestimatedTasks} Underestimated
          </Badge>
        </div>

        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Insights</p>
            <ul className="space-y-1">
              {data.insights.map((insight, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Individual Tasks */}
        {data.tasks.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Individual Tasks</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.tasks.map((task) => (
                <div key={task.taskId} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{task.taskTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMinutes(task.estimatedMinutes)} → {formatMinutes(task.actualMinutes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge
                      variant={task.accuracyPercent >= 80 ? 'default' : task.accuracyPercent >= 60 ? 'secondary' : 'destructive'}
                      className="whitespace-nowrap"
                    >
                      {task.accuracyPercent}%
                    </Badge>
                    {task.varianceMinutes !== 0 && (
                      <span className={`text-xs ${task.varianceMinutes > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {task.varianceMinutes > 0 ? '+' : ''}{task.varianceMinutes}m
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
