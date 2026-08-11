import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CalendarX, ArrowRight, X } from 'lucide-react';
import { Link } from 'react-router';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { addDays } from '@/lib/time-utils';

type Block = {
  id: string;
  startAt: string;
  endAt: string;
  taskId: string | null;
  status: string;
};

type AlertLevel = 'healthy' | 'warning' | 'critical' | 'overbooked';

export function BudgetHealthAlert() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayEnd = useMemo(() => addDays(todayStart, 1), [todayStart]);

  useEffect(() => {
    const loadBlocks = async () => {
      try {
        const data = await apiFetch<Block[]>(
          `/api/time-blocks?from=${todayStart.toISOString()}&to=${todayEnd.toISOString()}`
        );
        setBlocks(data);
      } catch (error) {
        console.error('Failed to load time blocks:', error);
      } finally {
        setLoading(false);
      }
    };
    loadBlocks();
  }, [todayStart, todayEnd]);

  // Calculate capacity metrics
  const metrics = useMemo(() => {
    const WORKDAY_MINUTES = 8 * 60; // 8 hours

    // Only count non-completed blocks
    const activeBlocks = blocks.filter(b =>
      b.status !== 'completed' && b.status !== 'skipped'
    );

    const bookedMinutes = activeBlocks.reduce((sum, b) => {
      const start = new Date(b.startAt).getTime();
      const end = new Date(b.endAt).getTime();
      return sum + Math.round((end - start) / 60_000);
    }, 0);

    const freeMinutes = Math.max(0, WORKDAY_MINUTES - bookedMinutes);
    const overbookedMinutes = Math.max(0, bookedMinutes - WORKDAY_MINUTES);
    const loadPercentage = Math.min(100, Math.round((bookedMinutes / WORKDAY_MINUTES) * 100));

    let level: AlertLevel = 'healthy';
    if (overbookedMinutes > 0) level = 'overbooked';
    else if (freeMinutes < 30) level = 'critical';
    else if (freeMinutes < 120) level = 'warning';

    return {
      bookedMinutes,
      freeMinutes,
      overbookedMinutes,
      loadPercentage,
      level,
      activeBlocks: activeBlocks.length,
      totalBlocks: blocks.length
    };
  }, [blocks]);

  // Check if dismissed for today
  useEffect(() => {
    const todayKey = todayStart.toISOString().split('T')[0];
    const dismissedKey = `budget-alert-dismissed-${todayKey}`;
    const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
    setDismissed(wasDismissed);
  }, [todayStart]);

  const handleDismiss = () => {
    const todayKey = todayStart.toISOString().split('T')[0];
    const dismissedKey = `budget-alert-dismissed-${todayKey}`;
    localStorage.setItem(dismissedKey, 'true');
    setDismissed(true);
  };

  if (loading || dismissed || metrics.level === 'healthy') {
    return null;
  }

  const alertConfig = {
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'text-amber-600 dark:text-amber-400',
      title: 'Approaching capacity',
      description: `You have ${fmtTime(metrics.freeMinutes)} of free time today. Consider planning ahead for unexpected tasks.`
    },
    critical: {
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      border: 'border-orange-200 dark:border-orange-800',
      icon: 'text-orange-600 dark:text-orange-400',
      title: 'Nearly at capacity',
      description: `Only ${fmtTime(metrics.freeMinutes)} remaining today. Block out focus time or defer lower-priority tasks.`
    },
    overbooked: {
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      title: 'Overbooked today',
      description: `You're ${fmtTime(metrics.overbookedMinutes)} over your 8-hour daily budget. Consider rescheduling or reducing scope.`
    }
  }[metrics.level];

  return (
    <Card className={cn('border-2', alertConfig.border, alertConfig.bg)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-md p-2', alertConfig.bg.replace('/20', '/10'))}>
            <AlertTriangle className={cn('h-5 w-5', alertConfig.icon)} />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className={cn('font-semibold', alertConfig.icon)}>
                  {alertConfig.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {alertConfig.description}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50">
                <span className="font-medium">{fmtTime(metrics.bookedMinutes)}</span>
                <span className="text-muted-foreground">booked</span>
              </div>
              <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md',
                metrics.overbookedMinutes > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-background/50')}>
                <span className="font-medium">{metrics.overbookedMinutes > 0 ? `+${fmtTime(metrics.overbookedMinutes)}` : fmtTime(metrics.freeMinutes)}</span>
                <span className="text-muted-foreground">{metrics.overbookedMinutes > 0 ? 'over' : 'free'}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50">
                <span className="font-medium">{metrics.loadPercentage}%</span>
                <span className="text-muted-foreground">load</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/planner">
                  <CalendarX className="h-3.5 w-3.5" />
                  Reschedule blocks
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/tasks?filter=backlog">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Move to backlog
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
