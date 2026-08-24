import { useMemo, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Award, Calendar, BarChart3, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';
import { calculateVelocityStats, formatPeriodKey } from '@/lib/task-velocity';

interface Task {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TimeBlock {
  id: string;
  taskId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type ViewPeriod = 'daily' | 'weekly' | 'monthly';

export function TaskVelocityDashboard() {
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('daily');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);

    // Fetch tasks from the last 90 days
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    Promise.all([
      apiFetch<Task[]>(`/api/tasks?status=backlog&status=todo&status=doing&status=done`),
      apiFetch<TimeBlock[]>(`/api/time-blocks?from=${ninetyDaysAgo.toISOString()}&to=${now.toISOString()}`),
    ])
      .then(([tasksData, blocksData]) => {
        setTasks(tasksData);
        setTimeBlocks(blocksData);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    return calculateVelocityStats(tasks as Task[], timeBlocks as TimeBlock[]);
  }, [tasks, timeBlocks]);

  const currentData = stats[viewPeriod];
  const trend = stats.trends[viewPeriod];

  // Calculate max for chart scaling
  const maxValue = useMemo(() => {
    const completed = currentData.map(d => d.completed);
    return completed.length > 0 ? Math.max(...completed) : 0;
  }, [currentData]);

  // Get trend color and icon
  const getTrendDisplay = (value: number) => {
    if (value > 0) {
      return {
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        icon: <TrendingUp className="size-4" />,
        label: `+${value}%`,
      };
    } else if (value < 0) {
      return {
        color: 'text-red-600',
        bg: 'bg-red-50',
        icon: <TrendingDown className="size-4" />,
        label: `${value}%`,
      };
    }
    return {
      color: 'text-muted-foreground',
      bg: 'bg-muted',
      icon: null,
      label: '0%',
    };
  };

  const currentTrend = getTrendDisplay(trend);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart3 className="size-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium">Unable to load velocity data</p>
          <p className="text-xs text-muted-foreground mt-1">
            Please check your connection and try again
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Today/This Period */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="size-4" />
              {viewPeriod === 'daily' ? 'Today' : viewPeriod === 'weekly' ? 'This Week' : 'This Month'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {viewPeriod === 'daily' ? stats.currentDay.completed :
               viewPeriod === 'weekly' ? stats.currentWeek.completed :
               stats.currentMonth.completed}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              tasks completed
            </p>
          </CardContent>
        </Card>

        {/* Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="size-4" />
              Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold flex items-center gap-2', currentTrend.color)}>
              {currentTrend.icon}
              {currentTrend.label}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs. previous period
            </p>
          </CardContent>
        </Card>

        {/* Average */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="size-4" />
              Avg. Daily
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageDaily}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              last 7 days
            </p>
          </CardContent>
        </Card>

        {/* Best Day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="size-4" />
              Best Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.bestDay ? stats.bestDay.completed : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.bestDay ? formatPeriodKey(stats.bestDay.date, 'day') : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Completion Velocity</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewPeriod === 'daily' ? 'default' : 'outline'}
                onClick={() => setViewPeriod('daily')}
              >
                Daily
              </Button>
              <Button
                size="sm"
                variant={viewPeriod === 'weekly' ? 'default' : 'outline'}
                onClick={() => setViewPeriod('weekly')}
              >
                Weekly
              </Button>
              <Button
                size="sm"
                variant={viewPeriod === 'monthly' ? 'default' : 'outline'}
                onClick={() => setViewPeriod('monthly')}
              >
                Monthly
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="size-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">No velocity data</p>
              <p className="text-xs text-muted-foreground mt-1">
                Complete tasks to see your velocity trends
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chart visualization */}
              <div className="flex items-end gap-1 h-40">
                {currentData.slice(-14).map((data, index) => {
                  const height = maxValue > 0 ? (data.completed / maxValue) * 100 : 0;
                  const isCurrent = index === currentData.slice(-14).length - 1;

                  return (
                    <div
                      key={data.date}
                      className="flex-1 flex flex-col items-center gap-2 group"
                    >
                      <div className="relative w-full flex items-end justify-center">
                        <div
                          className={cn(
                            'w-full rounded-t transition-all hover:opacity-80',
                            isCurrent ? 'bg-indigo-500' : 'bg-indigo-300',
                            data.completed === 0 && 'bg-muted'
                          )}
                          style={{ height: `${Math.max(height, 4)}%` }}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                            <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                              <div className="font-medium">{formatPeriodKey(data.date, viewPeriod)}</div>
                              <div className="text-gray-300">{data.completed} completed</div>
                              <div className="text-gray-300">{data.created} created</div>
                              <div className="text-gray-300">{data.completionRate}% rate</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate w-full text-center">
                        {viewPeriod === 'daily'
                          ? new Date(data.date).toLocaleDateString('en-US', { day: 'numeric' })
                          : viewPeriod === 'weekly'
                          ? data.date.split('-W')[1]
                          : new Date(data.date + '-01').toLocaleDateString('en-US', { month: 'short' })
                        }
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="size-3 rounded bg-indigo-500" />
                  <span className="text-muted-foreground">Current period</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-3 rounded bg-indigo-300" />
                  <span className="text-muted-foreground">Previous periods</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-3 rounded bg-muted" />
                  <span className="text-muted-foreground">No activity</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {currentData.slice(-7).reverse().map((data) => {
              const rateColor = data.completionRate >= 80 ? 'text-emerald-600' :
                               data.completionRate >= 50 ? 'text-amber-600' :
                               'text-red-600';

              return (
                <div
                  key={data.date}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">
                      {formatPeriodKey(data.date, viewPeriod)}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {data.completed} completed
                      </Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {data.created} created
                      </Badge>
                    </div>
                  </div>
                  <div className={cn('text-sm font-medium', rateColor)}>
                    {data.completionRate}%
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
