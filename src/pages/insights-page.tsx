import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, TrendingUp, Clock, Target, Zap, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type InsightsData = {
  from: string;
  to: string;
  productivityScore: number;
  peakHours: Array<{ hour: number; productivity: number; taskCount: number }>;
  completionTrends: Array<{ date: string; completionRate: number; taskCount: number }>;
  recommendations: string[];
};

type EnergyPatternsData = {
  from: string;
  to: string;
  hourlyAnalysis: Array<{ hour: number; avgEnergyLevel: number; taskCount: number; completionRate: number }>;
  optimalSchedule: Array<{ hour: number; recommendedTaskType: string; reasoning: string }>;
  insights: string[];
};

type CompletionRatesData = {
  taskCompletion: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgCompletionTime: number;
    byPriority: Array<{ priority: number; total: number; completed: number; rate: number }>;
  };
  habitCompletion: {
    totalHabits: number;
    activeHabits: number;
    totalEntries: number;
    completedEntries: number;
    completionRate: number;
    streakData: Array<{ habitId: string; habitName: string; currentStreak: number; bestStreak: number }>;
  };
  weeklyTrends: Array<{ week: string; taskRate: number; habitRate: number }>;
  insights: string[];
};

export function InsightsPage() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [energyPatterns, setEnergyPatterns] = useState<EnergyPatternsData | null>(null);
  const [completionRates, setCompletionRates] = useState<CompletionRatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Calculate date range (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        from: thirtyDaysAgo.toISOString(),
        to: now.toISOString(),
      });

      // Fetch all insights data in parallel
      const [insightsRes, energyRes, completionRes] = await Promise.all([
        fetch(`/api/reports?kind=insights&${params.toString()}`, { headers }),
        fetch(`/api/reports?kind=energy-patterns&${params.toString()}`, { headers }),
        fetch(`/api/reports?kind=completion-rates`, { headers }),
      ]);

      if (!insightsRes.ok || !energyRes.ok || !completionRes.ok) {
        throw new Error('Failed to fetch insights data');
      }

      const [insightsData, energyData, completionData] = await Promise.all([
        insightsRes.json(),
        energyRes.json(),
        completionRes.json(),
      ]);

      setInsights(insightsData);
      setEnergyPatterns(energyData);
      setCompletionRates(completionData);
    } catch (err) {
      console.error('Failed to fetch insights:', err);
      setError('Failed to load insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your productivity insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchData}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!insights || !energyPatterns || !completionRates) {
    return null;
  }

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}${ampm}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Productivity Insights</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your personal productivity patterns and recommendations
            </p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} title="Refresh insights">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Productivity Score Card */}
      <Card className={cn('border-2', getScoreBg(insights.productivityScore))}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Productivity Score
          </CardTitle>
          <CardDescription>Based on your completion rates and activity patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={cn('text-6xl font-bold', getScoreColor(insights.productivityScore))}>
              {insights.productivityScore}
            </div>
            <div className="flex-1">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={cn('h-3 rounded-full transition-all', getScoreBg(insights.productivityScore).replace('100', '500'))}
                  style={{ width: `${insights.productivityScore}%` }}
                ></div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {insights.productivityScore >= 80 ? 'Excellent productivity!' :
                  insights.productivityScore >= 60 ? 'Good progress with room to improve.' :
                  'Focus on completing tasks to boost your score.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Insights Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Peak Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              Peak Productivity Hours
            </CardTitle>
            <CardDescription>When you're most effective</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.peakHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough data yet. Keep logging tasks!</p>
            ) : (
              <div className="space-y-3">
                {insights.peakHours.slice(0, 5).map((hour, index) => (
                  <div key={hour.hour} className="flex items-center gap-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'} className="w-8 justify-center">
                      {index + 1}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{formatHour(hour.hour)}</span>
                        <span className="text-sm text-muted-foreground">{hour.productivity}% completion</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${hour.productivity}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completion Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5" />
              Completion Rates
            </CardTitle>
            <CardDescription>Your task and habit performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Tasks</span>
                  <span className="text-sm font-bold">{completionRates.taskCompletion.completionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${completionRates.taskCompletion.completionRate}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {completionRates.taskCompletion.completedTasks} of {completionRates.taskCompletion.totalTasks} tasks
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Habits</span>
                  <span className="text-sm font-bold">{completionRates.habitCompletion.completionRate}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${completionRates.habitCompletion.completionRate}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {completionRates.habitCompletion.completedEntries} of {completionRates.habitCompletion.totalEntries} entries
                </p>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Avg task completion: {completionRates.taskCompletion.avgCompletionTime} hours
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Energy Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5" />
              Energy Patterns
            </CardTitle>
            <CardDescription>Your optimal work times</CardDescription>
          </CardHeader>
          <CardContent>
            {energyPatterns.optimalSchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground">Complete more tasks with energy tracking to unlock patterns.</p>
            ) : (
              <div className="space-y-3">
                {energyPatterns.optimalSchedule.slice(0, 4).map((schedule) => (
                  <div key={schedule.hour} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{formatHour(schedule.hour)}</span>
                    </div>
                    <p className="text-sm font-medium text-primary">{schedule.recommendedTaskType}</p>
                    <p className="text-xs text-muted-foreground mt-1">{schedule.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Personalized Recommendations
          </CardTitle>
          <CardDescription>AI-powered suggestions to improve your productivity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.recommendations.map((rec, index) => (
              <div key={index} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </Badge>
                <p className="text-sm">{rec}</p>
              </div>
            ))}
            {energyPatterns.insights.map((insight, index) => (
              <div key={`energy-${index}`} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center flex-shrink-0">
                  {insights.recommendations.length + index + 1}
                </Badge>
                <p className="text-sm">{insight}</p>
              </div>
            ))}
            {completionRates.insights.map((insight, index) => (
              <div key={`completion-${index}`} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center flex-shrink-0">
                  {insights.recommendations.length + energyPatterns.insights.length + index + 1}
                </Badge>
                <p className="text-sm">{insight}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weekly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Trends</CardTitle>
          <CardDescription>Your 4-week productivity trajectory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {completionRates.weeklyTrends.map((week) => {
              const weekStart = new Date(week.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={week.week}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Week of {weekStart}</span>
                    <div className="flex gap-4">
                      <span className="text-xs text-muted-foreground">Tasks: {week.taskRate}%</span>
                      <span className="text-xs text-muted-foreground">Habits: {week.habitRate}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${week.taskRate}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${week.habitRate}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Habit Streaks */}
      {completionRates.habitCompletion.streakData.filter(h => h.currentStreak >= 3).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Habit Streaks</CardTitle>
            <CardDescription>Keep up the momentum!</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completionRates.habitCompletion.streakData
                .filter(h => h.currentStreak >= 3)
                .map((streak) => (
                  <div key={streak.habitId} className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{streak.habitName}</span>
                      <Badge variant="secondary">{streak.currentStreak} days</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Best: {streak.bestStreak} days
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default InsightsPage;