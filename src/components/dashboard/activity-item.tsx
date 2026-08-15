import { formatDistanceToNow } from 'date-fns';
import { ActivityIcon } from './activity-icon';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ActivityItemProps = {
  action: string;
  entityType: string;
  metadata: Record<string, any>;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  className?: string;
};

export function ActivityItem({
  action,
  entityType,
  metadata,
  createdAt,
  user,
  className,
}: ActivityItemProps) {
  const getActionText = () => {
    if (action === 'task_created') return 'created a new task';
    if (action === 'task_completed') return 'completed a task';
    if (action === 'task_updated') return 'updated a task';
    if (action === 'task_deleted') return 'deleted a task';
    if (action === 'task_reassigned') return 'reassigned a task';
    if (action === 'booking_created') return 'received a booking request';
    if (action === 'booking_approved') return 'approved a booking';
    if (action === 'booking_rejected') return 'rejected a booking';
    if (action === 'booking_cancelled') return 'cancelled a booking';
    if (action === 'achievement_unlocked') return 'unlocked an achievement';
    if (action === 'achievement_progress') return 'made progress on an achievement';
    if (action === 'user_role_changed') return 'changed user role';
    if (action === 'user_joined') return 'joined the team';
    if (action === 'time_block_created') return 'scheduled a time block';
    if (action === 'time_block_updated') return 'updated a time block';
    if (action === 'time_block_completed') return 'completed a time block';
    if (action === 'goal_created') return 'created a goal';
    if (action === 'goal_updated') return 'updated a goal';
    if (action === 'goal_completed') return 'completed a goal';
    if (action === 'habit_completed') return 'completed a habit';
    if (action === 'comment_added') return 'added a comment';
    return `performed ${action}`;
  };

  const getActionBadge = () => {
    if (action.includes('completed') || action.includes('approved') || action === 'achievement_unlocked') {
      return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">Success</Badge>;
    }
    if (action.includes('deleted') || action.includes('rejected') || action.includes('cancelled')) {
      return <Badge variant="destructive">Removed</Badge>;
    }
    if (action.includes('created') || action.includes('updated')) {
      return <Badge variant="secondary">Update</Badge>;
    }
    return <Badge variant="outline">Activity</Badge>;
  };

  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  return (
    <div className={cn('flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors', className)}>
      <ActivityIcon action={action} entityType={entityType} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">
            {user?.name || 'Unknown user'}
          </span>
          <span className="text-muted-foreground text-sm">
            {getActionText()}
          </span>
          {getActionBadge()}
        </div>

        {metadata.title && (
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {metadata.title}
          </p>
        )}

        {metadata.priority && (
          <span className="text-xs text-muted-foreground">
            Priority: {metadata.priority}
          </span>
        )}

        {metadata.assignee && (
          <span className="text-xs text-muted-foreground">
            Assigned to: {metadata.assignee}
          </span>
        )}

        {entityType === 'achievement' && metadata.points && (
          <span className="text-xs font-semibold text-yellow-600">
            +{metadata.points} points
          </span>
        )}

        <p className="text-xs text-muted-foreground mt-1">
          {timeAgo}
        </p>
      </div>
    </div>
  );
}