import { useState, useEffect } from 'react';
import { Clock, Zap, Calendar, ArrowRight, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { addDays, startOfDay } from '@/lib/time-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type Block = { startAt: string; energyLevel: number | null };
type Task = { id: string; title: string; estimatedMinutes: number; status: string };

interface TimeWindow {
  hour: number;
  endHour: number;
  avgEnergy: number;
  confidence: number;
  sampleCount: number;
  label: string;
  color: string;
}

interface EnergyForecast {
  today: TimeWindow[];
  timezone: string;
  peakWindow: TimeWindow | null;
  lowWindow: TimeWindow | null;
  insights: string[];
}

export function DailyEnergyScheduler() {
  const [forecast, setForecast] = useState<EnergyForecast | null>(null);
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = startOfDay(new Date());
      const thirtyDaysAgo = addDays(today, -30);

      // Fetch energy data and tasks in parallel
      const [blocks, tasks] = await Promise.all([
        apiFetch<Block[]>(`/api/time-blocks?from=${thirtyDaysAgo.toISOString()}&to=${today.toISOString()}`),
        apiFetch<Task[]>('/api/tasks'),
      ]);

      // Analyze energy patterns by hour
      const hourlyMap = new Map<number, { sum: number; count: number }>();
      blocks.forEach(b => {
        if (b.energyLevel == null) return;
        const hour = new Date(b.startAt).getHours();
        const existing = hourlyMap.get(hour) ?? { sum: 0, count: 0 };
        hourlyMap.set(hour, { sum: existing.sum + b.energyLevel, count: existing.count + 1 });
      });

      // Create 2-hour time windows
      const windows: TimeWindow[] = [];
      for (let h = 6; h <= 20; h += 2) {
        const windowHours = [h, h + 1];
        const sum = windowHours.reduce((s, hour) => {
          const data = hourlyMap.get(hour);
          return s + (data?.sum ?? 0);
        }, 0);
        const count = windowHours.reduce((c, hour) => {
          const data = hourlyMap.get(hour);
          return c + (data?.count ?? 0);
        }, 0);
        const avgEnergy = count > 0 ? sum / count : 0;
        const confidence = Math.min(100, Math.round((count / 30) * 100));

        let label = 'Moderate';
        let color = '#eab308';
        if (avgEnergy >= 4) {
          label = 'Peak Focus';
          color = '#22c55e';
        } else if (avgEnergy >= 3) {
          label = 'Good Energy';
          color = '#3b82f6';
        } else if (avgEnergy > 0 && avgEnergy < 3) {
          label = 'Light Tasks';
          color = '#f97316';
        }

        windows.push({
          hour: h,
          endHour: h + 2,
          avgEnergy: count > 0 ? avgEnergy : 2.5,
          confidence,
          sampleCount: count,
          label: count > 0 ? label : 'Unknown',
          color: count > 0 ? color : '#94a3b8',
        });
      }

      const peakWindow = windows.reduce((best, w) =>
        w.avgEnergy > best.avgEnergy && w.sampleCount >= 3 ? w : best, windows[0]);
      const lowWindow = windows.reduce((low, w) =>
        w.avgEnergy < low.avgEnergy && w.sampleCount >= 3 ? w : low, windows[windows.length - 1]);

      const insights: string[] = [];
      if (peakWindow.sampleCount >= 3) {
        insights.push(`Peak productivity: ${peakWindow.hour}:00–${peakWindow.endHour}:00`);
      }
      if (lowWindow.sampleCount >= 3 && lowWindow.avgEnergy < 3) {
        insights.push(`Save routine tasks for ${lowWindow.hour}:00–${lowWindow.endHour}:00`);
      }
      if (windows.every(w => w.sampleCount < 3)) {
        insights.push('Keep tracking energy levels to unlock personalized insights');
      }

      setForecast({
        today: windows,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        peakWindow: peakWindow.sampleCount >= 3 ? peakWindow : null,
        lowWindow: lowWindow.sampleCount >= 3 ? lowWindow : null,
        insights,
      });

      // Filter unscheduled high-priority tasks
      setUnscheduledTasks(
        tasks.filter(t => t.status !== 'done' && t.status !== 'archived' && t.estimatedMinutes > 0)
          .sort((a, b) => b.estimatedMinutes - a.estimatedMinutes)
          .slice(0, 5)
      );
    } catch {
      console.error('Failed to load energy forecast');
    } finally {
      setLoading(false);
    }
  };

  const scheduleTaskInWindow = async (task: Task, window: TimeWindow) => {
    setScheduling(task.id);
    try {
      const now = new Date();
      const startAt = new Date(now);
      startAt.setHours(window.hour, 0, 0, 0);
      const endAt = new Date(now);
      endAt.setHours(window.endHour, 0, 0, 0);

      // Create time block
      await apiFetch('/api/time-blocks', {
        method: 'POST',
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          status: 'planned',
        }),
      });

      toast.success(`Scheduled "${task.title}" for ${window.hour}:00–${window.endHour}:00`);

      // Refresh data
      loadData();
    } catch (err) {
      toast.error('Failed to schedule task');
    } finally {
      setScheduling(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4" />
            Energy-based scheduler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!forecast) {
    return null;
  }

  const hasData = forecast.today.some(w => w.sampleCount >= 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="size-4" />
            Today's energy forecast
          </span>
          {!hasData && (
            <Badge variant="outline" className="text-xs">Needs data</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Insights */}
        {forecast.insights.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            {forecast.insights.map((insight, i) => (
              <p key={i} className="text-xs text-muted-foreground">💡 {insight}</p>
            ))}
          </div>
        )}

        {/* Time windows */}
        <div className="space-y-2">
          {forecast.today.map(window => (
            <div
              key={window.hour}
              className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Clock className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {window.hour}:00–{window.endHour}:00
                    </span>
                    {window.sampleCount >= 3 ? (
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{ backgroundColor: `${window.color}20`, color: window.color, border: `1px solid ${window.color}40` }}
                      >
                        {window.label}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {window.sampleCount > 0 ? `${window.sampleCount} samples` : 'No data'}
                      </Badge>
                    )}
                  </div>
                  {window.sampleCount >= 3 && (
                    <p className="text-xs text-muted-foreground">
                      Avg energy: {window.avgEnergy.toFixed(1)}/5.0 • {window.confidence}% confidence
                    </p>
                  )}
                </div>
              </div>

              {/* Quick schedule button */}
              {unscheduledTasks.length > 0 && window.sampleCount >= 3 && (
                <div className="flex items-center gap-1">
                  {unscheduledTasks.slice(0, 2).map(task => (
                    <Button
                      key={task.id}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={scheduling === task.id}
                      onClick={() => scheduleTaskInWindow(task, window)}
                      title={`Schedule "${task.title}" (${task.estimatedMinutes}m)`}
                    >
                      {scheduling === task.id ? (
                        <Sparkles className="size-3 animate-pulse" />
                      ) : (
                        <>
                          <Calendar className="size-3" />
                          <ArrowRight className="size-3" />
                        </>
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Unscheduled tasks hint */}
        {unscheduledTasks.length > 0 && forecast.peakWindow && (
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
            <p className="text-xs font-medium text-primary mb-2">
              📋 {unscheduledTasks.length} unscheduled tasks ready to schedule
            </p>
            <div className="flex flex-wrap gap-2">
              {unscheduledTasks.slice(0, 3).map(task => (
                <Badge key={task.id} variant="outline" className="text-xs">
                  {task.title} ({task.estimatedMinutes}m)
                </Badge>
              ))}
              {unscheduledTasks.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{unscheduledTasks.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {!hasData && (
          <p className="text-xs text-muted-foreground">
            Rate your energy when completing tasks to unlock personalized scheduling recommendations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
