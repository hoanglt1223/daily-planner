import { DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface MeetingCostBadgeProps {
  cost: number | null;
  duration?: number; // in minutes
  loading?: boolean;
}

export function MeetingCostBadge({ cost, duration, loading }: MeetingCostBadgeProps) {
  if (loading) {
    return <Skeleton className="h-5 w-16 inline-block" />;
  }

  if (cost === null || cost === 0) {
    return null;
  }

  const formatCost = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value}`;
  };

  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <DollarSign className="h-3 w-3" />
      {formatCost(cost)}
      {duration && duration > 0 && (
        <span className="text-xs text-muted-foreground">
          ({Math.round(cost / (duration / 60))}/h)
        </span>
      )}
    </Badge>
  );
}
