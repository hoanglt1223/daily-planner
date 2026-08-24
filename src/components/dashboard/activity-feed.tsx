import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Filter, Calendar, User as UserIcon, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { addDays, startOfWeek } from '@/lib/time-utils';
import { ActivityItem } from './activity-item';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Activity = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

type FilterType = 'all' | 'tasks' | 'bookings' | 'achievements' | 'time_blocks' | 'goals' | 'habits';
type TimeRange = 'today' | 'week' | 'month' | 'all';

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('week');

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      let from = new Date();
      let to = new Date();

      switch (timeRange) {
        case 'today':
          from = new Date(now.setHours(0, 0, 0, 0));
          to = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'week':
          from = startOfWeek(new Date());
          to = addDays(from, 7);
          break;
        case 'month':
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'all':
          from = new Date(2020, 0, 1); // Far past
          to = new Date(2030, 0, 1); // Far future
          break;
      }

      const entityType = filterType === 'all' ? undefined : filterType;

      const response = await apiFetch<{ activities: Activity[] }>(
        `/api/reports?kind=activities&from=${from.toISOString()}&to=${to.toISOString()}${entityType ? `&entityType=${entityType}` : ''}&limit=100`
      );

      setActivities(response.activities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [filterType, timeRange]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadActivities();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadActivities]);

  const getFilteredActivities = () => {
    return activities;
  };

  const getEmptyState = () => {
    if (filterType !== 'all') {
      return `No ${filterType} activities in this time range`;
    }
    if (timeRange === 'today') {
      return 'No activities today. Get started by creating a task!';
    }
    return 'No activities found in this time range';
  };

  const displayActivities = getFilteredActivities();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5" />
              Activity Feed
            </CardTitle>
            <CardDescription>Track team actions and system events</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="size-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="size-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="tasks">Tasks</SelectItem>
                <SelectItem value="bookings">Bookings</SelectItem>
                <SelectItem value="achievements">Achievements</SelectItem>
                <SelectItem value="time_blocks">Time Blocks</SelectItem>
                <SelectItem value="goals">Goals</SelectItem>
                <SelectItem value="habits">Habits</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="icon"
              variant="outline"
              onClick={loadActivities}
              disabled={loading}
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={loadActivities}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        ) : displayActivities.length === 0 ? (
          <div className="text-center py-8">
            <UserIcon className="size-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{getEmptyState()}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {displayActivities.map((activity) => (
              <ActivityItem
                key={activity.id}
                action={activity.action}
                entityType={activity.entityType}
                metadata={activity.metadata}
                createdAt={activity.createdAt}
                user={activity.user}
              />
            ))}
          </div>
        )}

        {!loading && !error && displayActivities.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {displayActivities.length} activities
              {timeRange !== 'all' && ` in ${timeRange}`}
              {filterType !== 'all' && ` for ${filterType}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}