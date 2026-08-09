import { useMemo } from 'react';
import { Calendar, Clock, Info, TrendingUp } from 'lucide-react';
import { format, isToday, isTomorrow, isSameDay, addDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { generateRecurringPreview, getRecurringPatternDescription, type RecurringRule, type PreviewInstance } from '@/lib/recurring-preview-utils';
import { cn } from '@/lib/utils';

interface RecurringTaskPreviewProps {
  title: string;
  startDate: Date;
  recurringRule: RecurringRule;
  maxInstances?: number;
  className?: string;
}

export function RecurringTaskPreview({
  title,
  startDate,
  recurringRule,
  maxInstances = 8,
  className
}: RecurringTaskPreviewProps) {
  const instances = useMemo(() => {
    return generateRecurringPreview(startDate, recurringRule, maxInstances);
  }, [startDate, recurringRule, maxInstances]);

  const patternDescription = useMemo(() => {
    return getRecurringPatternDescription(recurringRule);
  }, [recurringRule]);

  const formatRelativeDate = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isSameDay(date, addDays(new Date(), 2))) return 'In 2 days';

    const daysUntil = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 7) return `In ${daysUntil} days`;

    return format(date, 'MMM d, yyyy');
  };

  const getUrgencyColor = (date: Date): string => {
    if (isToday(date)) return 'text-red-600 dark:text-red-400';
    if (isTomorrow(date)) return 'text-orange-600 dark:text-orange-400';
    if (date.getTime() - new Date().getTime() <= 3 * 24 * 60 * 60 * 1000) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-muted-foreground';
  };

  if (instances.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="size-5" />
            Recurring Schedule Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No upcoming instances found for this recurring task
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="size-5" />
          Recurring Schedule Preview
        </CardTitle>
        <CardDescription className="text-xs">
          {patternDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] overflow-y-auto pr-2">
          <div className="space-y-2">
            {instances.map((instance, index) => (
              <div
                key={`${instance.date.toISOString()}-${index}`}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border bg-card transition-colors",
                  isToday(instance.date) && "border-primary/50 bg-primary/5",
                  isTomorrow(instance.date) && "border-orange-500/30 bg-orange-500/5"
                )}
              >
                <div className="flex flex-col items-center gap-1 min-w-[60px]">
                  <div className="text-center">
                    <div className={cn(
                      "text-xs font-semibold",
                      getUrgencyColor(instance.date)
                    )}>
                      {format(instance.date, 'MMM')}
                    </div>
                    <div className={cn(
                      "text-lg font-bold",
                      getUrgencyColor(instance.date)
                    )}>
                      {format(instance.date, 'd')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(instance.date, 'EEE')}
                    </div>
                  </div>
                  {index === 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Next
                    </Badge>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="size-3 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {instance.time}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({instance.duration} min)
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatRelativeDate(instance.date)}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-xs">
                    #{instance.index + 1}
                  </Badge>
                  {isToday(instance.date) && (
                    <Badge variant="default" className="text-xs bg-red-500">
                      Today
                    </Badge>
                  )}
                  {isTomorrow(instance.date) && (
                    <Badge variant="secondary" className="text-xs bg-orange-500">
                      Tomorrow
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {instances.length >= maxInstances && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="size-3" />
              <span>
                Showing first {maxInstances} instances • Schedule continues beyond preview window
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}