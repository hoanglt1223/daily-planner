import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCircle2, Calendar, DollarSign, Trophy, Target, User, Settings, Clock, Coffee, Moon, Music, Heart, Briefcase, AlertCircle, Info, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ActivityLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: {
    title?: string;
    priority?: number;
    assignee?: string;
    status?: string;
    [key: string]: any;
  };
  createdAt: string;
};

const ACTION_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  'task_created': { icon: CheckCircle2, color: 'text-blue-500', label: 'Task Created' },
  'task_completed': { icon: CheckCircle2, color: 'text-green-500', label: 'Task Completed' },
  'task_updated': { icon: Settings, color: 'text-yellow-500', label: 'Task Updated' },
  'task_deleted': { icon: AlertCircle, color: 'text-red-500', label: 'Task Deleted' },
  'booking_created': { icon: Calendar, color: 'text-blue-500', label: 'Booking Request' },
  'booking_approved': { icon: CheckCircle2, color: 'text-green-500', label: 'Booking Approved' },
  'booking_rejected': { icon: AlertCircle, color: 'text-red-500', label: 'Booking Rejected' },
  'booking_cancelled': { icon: AlertCircle, color: 'text-orange-500', label: 'Booking Cancelled' },
  'achievement_unlocked': { icon: Trophy, color: 'text-yellow-500', label: 'Achievement Unlocked' },
  'goal_created': { icon: Target, color: 'text-purple-500', label: 'Goal Created' },
  'goal_completed': { icon: Target, color: 'text-green-500', label: 'Goal Completed' },
  'habit_completed': { icon: CheckCircle2, color: 'text-green-500', label: 'Habit Completed' },
  'time_block_created': { icon: Calendar, color: 'text-blue-500', label: 'Time Block Created' },
  'time_block_completed': { icon: Clock, color: 'text-green-500', label: 'Time Block Completed' },
  'project_created': { icon: Briefcase, color: 'text-indigo-500', label: 'Project Created' },
  'project_completed': { icon: CheckCircle2, color: 'text-green-500', label: 'Project Completed' },
  'morning_ritual_completed': { icon: Coffee, color: 'text-orange-500', label: 'Morning Ritual' },
  'evening_winddown_completed': { icon: Moon, color: 'text-purple-500', label: 'Evening Wind-down' },
  'music_playlist_created': { icon: Music, color: 'text-pink-500', label: 'Playlist Created' },
  'wedding_planned': { icon: Heart, color: 'text-pink-500', label: 'Wedding Planned' },
  'user_updated': { icon: User, color: 'text-blue-500', label: 'Profile Updated' },
  'meeting_logged': { icon: DollarSign, color: 'text-green-500', label: 'Meeting Logged' },
};

const ENTITY_ICONS: Record<string, LucideIcon> = {
  'task': CheckCircle2,
  'booking': Calendar,
  'achievement': Trophy,
  'goal': Target,
  'habit': CheckCircle2,
  'time_block': Clock,
  'project': Briefcase,
  'user': User,
  'music_playlist': Music,
  'wedding': Heart,
};

function groupActivitiesByDate(activities: ActivityLog[]): Record<string, ActivityLog[]> {
  const groups: Record<string, ActivityLog[]> = {};

  activities.forEach(activity => {
    const date = new Date(activity.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateKey: string;
    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
  });

  return groups;
}

function getActivityDescription(action: string, metadata: Record<string, any>): string {
  switch (action) {
    case 'task_created':
      return `Created task "${metadata.title || 'Untitled'}"`;
    case 'task_completed':
      return `Completed task "${metadata.title || 'Untitled'}"${metadata.priority ? ` (Priority: ${metadata.priority})` : ''}`;
    case 'booking_approved':
      return `Approved booking for "${metadata.title || 'Meeting'}"`;
    case 'booking_rejected':
      return `Rejected booking for "${metadata.title || 'Meeting'}"`;
    case 'achievement_unlocked':
      return `Unlocked achievement: ${metadata.title || 'Achievement'}`;
    case 'goal_completed':
      return `Completed goal: ${metadata.title || 'Goal'}`;
    case 'habit_completed':
      return `Completed habit: ${metadata.title || 'Habit'}`;
    case 'project_completed':
      return `Completed project: ${metadata.title || 'Project'}`;
    default:
      return metadata.title || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

export function ActivityFeedPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ActivityLog[]>('/api/activity-logs')
      .then(data => {
        setActivities(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load activities');
        setLoading(false);
      });
  }, []);

  const groupedActivities = groupActivitiesByDate(activities);
  const dateKeys = Object.keys(groupedActivities);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Bell className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading activity feed...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-lg font-medium">No activity yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your activities will appear here as you use the app
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>
        <p className="text-sm text-muted-foreground">
          Your recent activities, achievements, and accomplishments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            {activities.length} activit{activities.length === 1 ? 'y' : 'ies'} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto pr-4">
            <div className="space-y-6">
              {dateKeys.map((dateKey) => (
                <div key={dateKey}>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground sticky top-0 bg-background py-2">
                    {dateKey}
                  </h3>
                  <div className="space-y-3">
                    {groupedActivities[dateKey].map((activity) => {
                      const config = ACTION_CONFIG[activity.action] || {
                        icon: Info,
                        color: 'text-gray-500',
                        label: activity.action
                      };
                      const Icon = config.icon;

                      return (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className={cn('mt-0.5', config.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm leading-tight">
                              {getActivityDescription(activity.action, activity.metadata)}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                              {activity.entityType && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-[9px] h-4 px-1">
                                    {activity.entityType}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
