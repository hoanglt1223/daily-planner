import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, CheckCircle2, Clock, Target, TrendingUp, Lightbulb, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, startOfWeek, format } from 'date-fns';

type WeeklyReviewResponse = {
  from: string;
  to: string;
  timeSummary: {
    totalPlannedMinutes: number;
    totalActualMinutes: number;
    totalCompletedMinutes: number;
    utilizationPercent: number;
    completionRate: number;
    daysWorked: number;
  };
  taskSummary: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    backlogTasks: number;
    highPriorityCompleted: number;
  };
  habitSummary: {
    totalHabits: number;
    activeHabits: number;
    totalEntries: number;
    completedEntries: number;
    streakData: Array<{ habitId: string; habitName: string; currentStreak: number }>;
  };
  goalProgress: Array<{
    goalId: string;
    title: string;
    targetValue: number;
    currentValue: number;
    progressPercent: number;
    status: string;
  }>;
  topTasks: Array<{
    taskId: string;
    title: string;
    status: string;
    priority: number;
    completedAt?: string;
  }>;
  insights: string[];
};

export default function WeeklyReviewPage() {
  const [data, setData] = useState<WeeklyReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    loadReview();
  }, [currentWeekStart]);

  const loadReview = async () => {
    setLoading(true);
    try {
      const weekEnd = addDays(currentWeekStart, 7);
      const response = await apiFetch<WeeklyReviewResponse>(
        `/api/reports/weekly-review?from=${currentWeekStart.toISOString()}&to=${weekEnd.toISOString()}`
      );
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weekly review');
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 2) return 'text-red-600 bg-red-50';
    if (priority <= 4) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      done: 'default',
      doing: 'secondary',
      todo: 'outline',
      backlog: 'outline',
    };
    return variants[status] || 'outline';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex items-center justify-between gap-4 py-6">
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button size="sm" variant="outline" onClick={loadReview}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Weekly Review</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(data.from)} – {formatDate(data.to)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>

      {/* Time Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Time Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMinutes(data.timeSummary.totalCompletedMinutes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.timeSummary.daysWorked} days worked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.timeSummary.completionRate}%</div>
            <Progress value={data.timeSummary.completionRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.timeSummary.utilizationPercent}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {data.timeSummary.daysWorked * 8}h available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Tasks Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold">{data.taskSummary.totalTasks}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{data.taskSummary.completedTasks}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{data.taskSummary.inProgressTasks}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">High Priority Done</p>
              <p className="text-2xl font-bold text-red-600">{data.taskSummary.highPriorityCompleted}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Habits & Goals */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Habits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active Habits</span>
                <span className="font-medium">{data.habitSummary.activeHabits}/{data.habitSummary.totalHabits}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entries Completed</span>
                <span className="font-medium">{data.habitSummary.completedEntries}/{data.habitSummary.totalEntries}</span>
              </div>
              {data.habitSummary.totalEntries > 0 && (
                <Progress
                  value={(data.habitSummary.completedEntries / data.habitSummary.totalEntries) * 100}
                  className="h-2"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Goals Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.goalProgress.length > 0 ? (
              <div className="space-y-3">
                {data.goalProgress.map((goal) => (
                  <div key={goal.goalId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium truncate">{goal.title}</span>
                      <span className="text-muted-foreground">{goal.currentValue}/{goal.targetValue}</span>
                    </div>
                    <Progress value={goal.progressPercent} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active goals</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Tasks */}
      {data.topTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topTasks.map((task) => (
                <div key={task.taskId} className="flex items-center justify-between p-3 rounded-md bg-muted/30">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Badge variant={getStatusBadge(task.status)} className="shrink-0">
                      {task.status}
                    </Badge>
                    <span className="font-medium truncate">{task.title}</span>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${getPriorityColor(task.priority)}`}>
                    P{task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {data.insights.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.insights.map((insight, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Next Week Planning</CardTitle>
          <CardDescription>Quick actions to plan ahead</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tasks">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Review Tasks
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/planner">
                <Calendar className="h-4 w-4 mr-2" />
                Open Planner
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/goals">
                <Target className="h-4 w-4 mr-2" />
                Update Goals
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/habits">
                <Calendar className="h-4 w-4 mr-2" />
                Manage Habits
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
