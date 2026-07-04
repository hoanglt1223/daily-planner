import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { addDays, startOfDay } from '@/lib/time-utils';

type Block = { startAt: string; energyLevel: number | null };

const ENERGY_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😴', label: 'Drained' },
  2: { emoji: '😐', label: 'Low' },
  3: { emoji: '🙂', label: 'OK' },
  4: { emoji: '😃', label: 'Good' },
  5: { emoji: '⚡', label: 'Peak' },
};

/** Analyzes energy patterns across completed time blocks over the last 30 days. */
export function EnergyPatterns() {
  const [hourlyData, setHourlyData] = useState<Array<{ hour: number; avgEnergy: number; count: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = addDays(today, -30);
    apiFetch<Block[]>(`/api/time-blocks?from=${thirtyDaysAgo.toISOString()}&to=${today.toISOString()}`)
      .then(blocks => {
        const hourlyMap = new Map<number, { sum: number; count: number }>();
        blocks.forEach(b => {
          if (b.energyLevel == null) return;
          const hour = new Date(b.startAt).getHours();
          const existing = hourlyMap.get(hour) ?? { sum: 0, count: 0 };
          hourlyMap.set(hour, { sum: existing.sum + b.energyLevel, count: existing.count + 1 });
        });
        const data = Array.from(hourlyMap.entries())
          .map(([hour, { sum, count }]) => ({ hour, avgEnergy: sum / count, count }))
          .sort((a, b) => a.hour - b.hour);
        setHourlyData(data);
      })
      .catch(() => setHourlyData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Energy patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hourlyData || hourlyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Energy patterns</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Rate your energy when completing tasks to see patterns here.</p>
        </CardContent>
      </Card>
    );
  }

  const bestHour = hourlyData.reduce((best, curr) => curr.avgEnergy > best.avgEnergy ? curr : best);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Energy patterns (30d)</span>
          <span className="text-xs font-normal text-muted-foreground">
            Best: {bestHour.hour}:00 ({ENERGY_LABELS[Math.round(bestHour.avgEnergy)].emoji})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {hourlyData.map(d => (
            <div key={d.hour} className="flex items-center gap-2 text-sm">
              <div className="w-10 text-xs text-muted-foreground">{String(d.hour).padStart(2, '0')}:00</div>
              <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                <div
                  className="h-full transition-all flex items-center justify-center text-xs font-medium"
                  style={{
                    width: `${(d.avgEnergy / 5) * 100}%`,
                    backgroundColor: d.avgEnergy >= 4 ? '#22c55e' : d.avgEnergy >= 3 ? '#eab308' : '#ef4444',
                    color: d.avgEnergy >= 4 ? '#166534' : d.avgEnergy >= 3 ? '#854d0e' : '#991b1b',
                  }}
                >
                  {d.count > 0 && ENERGY_LABELS[Math.round(d.avgEnergy)].emoji}
                </div>
              </div>
              <div className="w-8 text-xs text-muted-foreground text-right">{d.count}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Based on {hourlyData.reduce((s, d) => s + d.count, 0)} completed blocks with energy ratings.
        </p>
      </CardContent>
    </Card>
  );
}
