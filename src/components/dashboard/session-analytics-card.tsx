import { useEffect, useState } from 'react';
import { BarChart, Clock, Target, TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface SessionAnalytics {
  summary: {
    totalSessions: number;
    completedCount: number;
    completionRate: number;
    totalPlannedMinutes: number;
    totalActualMinutes: number;
    avgSessionDuration: number;
  };
  taskAnalytics: Array<{
    taskId: string;
    taskTitle: string;
    plannedMinutes: number;
    actualMinutes: number;
    sessionCount: number;
    accuracyRatio: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    completed: number;
    totalMinutes: number;
  }>;
}

export function SessionAnalyticsCard() {
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await apiFetch<SessionAnalytics>('/api/task-sessions?action=analytics');
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to load session analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics || analytics.summary.totalSessions === 0) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-1.5">
            <BarChart className="size-4 text-blue-600" />
            <p className="text-sm font-semibold">Session analytics</p>
          </div>
          <p className="text-xs text-muted-foreground text-center py-4">
            No focus sessions recorded yet. Start a timer to track your productivity!
          </p>
        </CardContent>
      </Card>
    );
  }

  const accuracyColor = (ratio: number) => {
    if (ratio >= 90 && ratio <= 110) return 'text-emerald-600';
    if (ratio >= 80 && ratio <= 120) return 'text-amber-600';
    return 'text-red-600';
  };

  const accuracyLabel = (ratio: number) => {
    if (ratio >= 90 && ratio <= 110) return 'Spot on';
    if (ratio > 110) return 'Underestimated';
    if (ratio < 80) return 'Overestimated';
    return 'Close';
  };

  return (
    <Card className="ring-1 ring-blue-200 dark:ring-blue-800/50">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BarChart className="size-4 text-blue-600" />
            <p className="text-sm font-semibold">Session analytics</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              <span className="text-[10px]">Sessions</span>
            </div>
            <p className="text-lg font-semibold">{analytics.summary.completedCount}</p>
            <p className="text-[9px] text-muted-foreground">
              {analytics.summary.completionRate}% complete
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Target className="size-3" />
              <span className="text-[10px]">Avg duration</span>
            </div>
            <p className="text-lg font-semibold">{analytics.summary.avgSessionDuration}m</p>
            <p className="text-[9px] text-muted-foreground">per session</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <TrendingUp className="size-3" />
              <span className="text-[10px]">Total focus</span>
            </div>
            <p className="text-lg font-semibold">
              {Math.round(analytics.summary.totalActualMinutes / 60)}h
            </p>
            <p className="text-[9px] text-muted-foreground">
              {analytics.summary.totalActualMinutes} minutes
            </p>
          </div>
        </div>

        {expanded && (
          <div className="space-y-4">
            {/* Task accuracy */}
            {analytics.taskAnalytics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Time estimation by task</p>
                <div className="space-y-1.5">
                  {analytics.taskAnalytics.slice(0, 5).map(task => (
                    <div key={task.taskId} className="flex items-center justify-between text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.taskTitle}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Planned: {task.plannedMinutes}m · Actual: {task.actualMinutes}m · {task.sessionCount} sessions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[9px]', accuracyColor(task.accuracyRatio))}>
                          {task.accuracyRatio}% {accuracyLabel(task.accuracyRatio)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily breakdown */}
            {analytics.dailyBreakdown.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Recent activity</p>
                <div className="space-y-1">
                  {analytics.dailyBreakdown.slice(-7).reverse().map(day => (
                    <div key={day.date} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{day.completed} sessions</span>
                        <span className="font-medium">{day.totalMinutes}m</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
