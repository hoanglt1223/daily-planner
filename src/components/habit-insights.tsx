import { TrendingUp, TrendingDown, Minus, Flame, Award, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HabitInsight {
  habitId: string;
  habitName: string;
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  completedEntries: number;
  completionRate: number;
  bestDay: string;
  bestDayRate: number;
  trend: number;
  lastDays: number;
}

interface HabitInsightsProps {
  insights: HabitInsight[];
  loading?: boolean;
}

export function HabitInsights({ insights, loading }: HabitInsightsProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading insights...</div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return null;
  }

  // Calculate overall stats
  const totalCurrentStreak = insights.reduce((sum, i) => sum + i.currentStreak, 0);
  const totalCompleted = insights.reduce((sum, i) => sum + i.completedEntries, 0);
  const totalEntries = insights.reduce((sum, i) => sum + i.totalEntries, 0);
  const overallCompletionRate = totalEntries > 0 ? Math.round((totalCompleted / totalEntries) * 100) : 0;
  const activeHabits = insights.filter(i => i.currentStreak > 0).length;

  return (
    <div className="space-y-4">
      {/* Overall Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Overall Progress
          </CardTitle>
          <CardDescription>Across all your habits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{overallCompletionRate}%</div>
              <div className="text-xs text-muted-foreground">Completion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{activeHabits}</div>
              <div className="text-xs text-muted-foreground">Active Streaks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{totalCurrentStreak}</div>
              <div className="text-xs text-muted-foreground">Total Streak Days</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{insights.length}</div>
              <div className="text-xs text-muted-foreground">Total Habits</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Habit Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        {insights.map(insight => (
          <Card key={insight.habitId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{insight.habitName}</CardTitle>
                <Badge variant={insight.completionRate >= 70 ? 'default' : 'secondary'}>
                  {insight.completionRate}% complete
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Streaks */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-600" />
                  <div>
                    <div className="text-sm font-medium">{insight.currentStreak} days</div>
                    <div className="text-xs text-muted-foreground">Current streak</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium">{insight.longestStreak} days</div>
                    <div className="text-xs text-muted-foreground">Longest streak</div>
                  </div>
                </div>
              </div>

              {/* Trend */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  {insight.trend > 5 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  ) : insight.trend < -5 ? (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">vs. previous week</span>
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    insight.trend > 5 ? 'text-emerald-600' : insight.trend < -5 ? 'text-red-600' : 'text-muted-foreground'
                  )}
                >
                  {insight.trend > 0 ? '+' : ''}{insight.trend}%
                </span>
              </div>

              {/* Best Day */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-muted-foreground">Best day</span>
                </div>
                <span className="text-sm font-medium">
                  {insight.bestDay} ({insight.bestDayRate}%)
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
