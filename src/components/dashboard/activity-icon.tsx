import { Check, Calendar, Trophy, User, Clock, Target, Award, MessageSquare, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type ActivityIconProps = {
  action: string;
  entityType: string;
  className?: string;
};

export function ActivityIcon({ action, entityType, className }: ActivityIconProps) {
  const getIcon = () => {
    // Task-related icons
    if (entityType === 'task') {
      switch (action) {
        case 'task_created': return <Sparkles className="size-4" />;
        case 'task_completed': return <Check className="size-4" />;
        case 'task_updated': return <Target className="size-4" />;
        case 'task_deleted': return <AlertCircle className="size-4" />;
        case 'task_reassigned': return <User className="size-4" />;
        default: return <Target className="size-4" />;
      }
    }

    // Booking-related icons
    if (entityType === 'booking') {
      switch (action) {
        case 'booking_approved': return <Check className="size-4" />;
        case 'booking_rejected': return <AlertCircle className="size-4" />;
        case 'booking_cancelled': return <AlertCircle className="size-4" />;
        default: return <Calendar className="size-4" />;
      }
    }

    // Achievement-related icons
    if (entityType === 'achievement') {
      return action === 'achievement_unlocked' ? <Trophy className="size-4" /> : <Award className="size-4" />;
    }

    // Time block icons
    if (entityType === 'time_block') {
      return <Clock className="size-4" />;
    }

    // Goal icons
    if (entityType === 'goal') {
      return <Target className="size-4" />;
    }

    // Comment icons
    if (entityType === 'comment') {
      return <MessageSquare className="size-4" />;
    }

    // User icons
    if (entityType === 'user') {
      return <User className="size-4" />;
    }

    // Default icon
    return <Sparkles className="size-4" />;
  };

  const getColorClass = () => {
    if (action.includes('completed') || action.includes('approved') || action === 'achievement_unlocked') {
      return 'text-green-600 bg-green-50';
    }
    if (action.includes('deleted') || action.includes('rejected') || action.includes('cancelled')) {
      return 'text-red-600 bg-red-50';
    }
    if (action.includes('created') || action.includes('updated')) {
      return 'text-blue-600 bg-blue-50';
    }
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className={cn('flex items-center justify-center w-8 h-8 rounded-full', getColorClass(), className)}>
      {getIcon()}
    </div>
  );
}