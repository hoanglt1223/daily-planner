import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Calendar, BarChart3, LineChart as LineChartIcon, ArrowLeft } from 'lucide-react';
import { fetchHabitAnalytics } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Habit {
  id: string;
  name: string;
  color: string;
  icon: string;
  frequency: 'daily' | 'weekly';
}

interface TimeSeriesData {
  date: string;
  formattedDate: string;
  [habitId: string]: string | number;
}

interface AnalyticsData {
  habits: Habit[];
  timeSeries: TimeSeriesData[];
  weekly: TimeSeriesData[];
  monthly: TimeSeriesData[];
  summary: {
    totalHabits: number;
    daysAnalyzed: number;
    dateRange: {
      from: string;
      to: string;
    };
  };
}

type ViewMode = 'daily' | 'weekly' | 'monthly';

export default function HabitAnalyticsPage() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [daysRange, setDaysRange] = useState(90);

  useEffect(() => {
    loadAnalytics();
  }, [daysRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await fetchHabitAnalytics(undefined, daysRange) as AnalyticsData;
      setAnalytics(data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getDataByViewMode = () => {
    if (!analytics) return [];
    switch (viewMode) {
      case 'daily': return analytics.timeSeries;
      case 'weekly': return analytics.weekly;
      case 'monthly': return analytics.monthly;
    }
  };

  const getDateLabel = (data: TimeSeriesData) => {
    switch (viewMode) {
      case 'daily': return data.formattedDate;
      case 'weekly': return (data as any).weekLabel;
      case 'monthly': return (data as any).monthLabel;
    }
  };

  const calculateHabitStats = (habitId: string) => {
    if (!analytics) return null;

    const data = analytics.timeSeries;
    const habitData = data.map(d => d[habitId] as number);
    const completed = habitData.filter(v => v === 100).length;
    const partial = habitData.filter(v => v > 0 && v < 100).length;
    const missed = habitData.filter(v => v === 0).length;

    const average = habitData.length > 0
      ? Math.round(habitData.reduce((sum, val) => sum + val, 0) / habitData.length)
      : 0;

    const recent = habitData.slice(-7);
    const recentAverage = recent.length > 0
      ? Math.round(recent.reduce((sum, val) => sum + val, 0) / recent.length)
      : 0;

    const older = habitData.slice(-14, -7);
    const olderAverage = older.length > 0
      ? Math.round(older.reduce((sum, val) => sum + val, 0) / older.length)
      : 0;

    const trend = recentAverage - olderAverage;

    return { completed, partial, missed, average, trend };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics || analytics.habits.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate('/habits')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Habits
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No habits found</h3>
            <p className="text-muted-foreground text-center">
              Create some habits first to see analytics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentData = getDataByViewMode();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/habits')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Habit Analytics</h1>
          <p className="text-muted-foreground">Deep insights into your habit performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(daysRange)} onValueChange={(v) => setDaysRange(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="180">180 days</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border rounded-lg">
            {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="rounded-none"
              >
                {mode === 'daily' && 'Day'}
                {mode === 'weekly' && 'Week'}
                {mode === 'monthly' && 'Month'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {analytics.habits.map(habit => {
          const stats = calculateHabitStats(habit.id);
          if (!stats) return null;

          return (
            <Card key={habit.id} style={{ borderTopColor: habit.color, borderTopWidth: '3px' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span style={{ color: habit.color }}>{habit.icon}</span>
                  {habit.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{stats.average}%</span>
                    <Badge variant={stats.trend > 5 ? 'default' : stats.trend < -5 ? 'destructive' : 'secondary'}>
                      {stats.trend > 5 ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : stats.trend < -5 ? (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      ) : null}
                      {stats.trend > 0 ? '+' : ''}{stats.trend}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="text-center">
                      <div className="font-medium text-emerald-600">{stats.completed}</div>
                      <div className="text-muted-foreground">Complete</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-yellow-600">{stats.partial}</div>
                      <div className="text-muted-foreground">Partial</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-red-600">{stats.missed}</div>
                      <div className="text-muted-foreground">Missed</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Time-based Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="w-5 h-5" />
            Completion Trends
          </CardTitle>
          <CardDescription>
            Track your habit performance over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Date Headers */}
            <div className="flex border-b pb-2">
              <div className="w-24 flex-shrink-0 font-medium text-sm">Habit</div>
              <div className="flex gap-1 overflow-x-auto flex-1">
                {currentData.slice(-14).map((data, index) => (
                  <div key={index} className="flex-shrink-0 w-8 text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      {getDateLabel(data)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Habit Rows */}
            {analytics.habits.map(habit => (
              <div key={habit.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                <div className="w-24 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <span style={{ color: habit.color }}>{habit.icon}</span>
                    <span className="text-sm font-medium truncate">{habit.name}</span>
                  </div>
                </div>
                <div className="flex gap-1 overflow-x-auto flex-1">
                  {currentData.slice(-14).map((data, index) => {
                    const value = data[habit.id] as number;
                    const bgColor = value === 100 ? habit.color :
                                   value > 0 ? `${habit.color}80` :
                                   '#f1f5f9';

                    return (
                      <div
                        key={index}
                        className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-medium"
                        style={{
                          backgroundColor: bgColor,
                          color: value > 50 ? '#fff' : '#64748b'
                        }}
                        title={`${value}%`}
                      >
                        {value > 0 ? value : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Summary Statistics
          </CardTitle>
          <CardDescription>
            Based on the last {daysRange} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-primary">{analytics.summary.totalHabits}</div>
              <div className="text-sm text-muted-foreground">Total Habits</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-emerald-600">
                {analytics.habits.filter(h => {
                  const stats = calculateHabitStats(h.id);
                  return stats && stats.average >= 70;
                }).length}
              </div>
              <div className="text-sm text-muted-foreground">On Track (≥70%)</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">
                {analytics.habits.filter(h => {
                  const stats = calculateHabitStats(h.id);
                  return stats && stats.average < 50;
                }).length}
              </div>
              <div className="text-sm text-muted-foreground">Need Attention (&lt;50%)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}