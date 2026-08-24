import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TaskAgeIndicatorProps {
  updatedAt: string;
  compact?: boolean;
}

export function TaskAgeIndicator({ updatedAt, compact = false }: TaskAgeIndicatorProps) {
  const updatedDate = new Date(updatedAt);
  const now = new Date();
  const daysSinceUpdate = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));

  let label: string;
  let colorClass: string;

  if (daysSinceUpdate < 2) {
    label = 'Updated recently';
    colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200';
  } else if (daysSinceUpdate < 7) {
    label = `Updated ${formatDistanceToNow(updatedDate, { addSuffix: true })}`;
    colorClass = 'text-sky-600 bg-sky-50 border-sky-200';
  } else if (daysSinceUpdate < 14) {
    label = `Updated ${formatDistanceToNow(updatedDate, { addSuffix: true })}`;
    colorClass = 'text-amber-600 bg-amber-50 border-amber-200';
  } else {
    label = `Updated ${formatDistanceToNow(updatedDate, { addSuffix: true })}`;
    colorClass = 'text-red-600 bg-red-50 border-red-200';
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium cursor-help',
              colorClass
            )}>
              <Clock className="size-2.5" />
              <span>{daysSinceUpdate}d</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>{label}</p>
            <p className="text-muted-foreground mt-1">Last activity: {updatedDate.toLocaleDateString()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium cursor-help',
            colorClass
          )}>
            <Clock className="size-3" />
            <span>{daysSinceUpdate < 1 ? 'Today' : formatDistanceToNow(updatedDate, { addSuffix: true })}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{label}</p>
          <p className="text-muted-foreground mt-1">Last activity: {updatedDate.toLocaleDateString()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
