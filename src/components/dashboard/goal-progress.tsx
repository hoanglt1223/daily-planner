import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Goal {
  id: string;
  title: string;
  status: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  color: string;
  period: string;
  endDate: string;
}

interface GoalProgressProps {
  userId?: string;
}

export function GoalProgress({ }: GoalProgressProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = () => {
    setLoading(true);
    apiFetch<Goal[]>('/api/goals')
      .then(setGoals)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const activeGoals = goals.filter(g => g.status === 'active').slice(0, 4);
  const hasGoals = activeGoals.length > 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goal Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!hasGoals) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goal Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-sm text-muted-foreground">
            No active goals. Set your first goal on the Goals page!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          Goal Progress
        </CardTitle>
        <CardDescription>Track your long-term objectives</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeGoals.map(goal => {
          const progressPercent = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
          const isCompleted = goal.status === 'completed';
          const isOnTrack = progressPercent >= 50;
          const isLagging = progressPercent < 25;

          return (
            <div key={goal.id} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-none">{goal.title}</p>
                    {isCompleted && (
                      <Badge variant="default" className="text-xs">Done</Badge>
                    )}
                    {isLagging && !isCompleted && (
                      <Badge variant="destructive" className="text-xs">Behind</Badge>
                    )}
                    {isOnTrack && !isCompleted && !isLagging && (
                      <Badge variant="secondary" className="text-xs">On Track</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {goal.currentValue} / {goal.targetValue}
                    {goal.unit && ` ${goal.unit}`}
                    <span className="ml-2">• {progressPercent}%</span>
                  </p>
                </div>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}