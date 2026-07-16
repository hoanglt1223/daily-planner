import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { addDays, startOfDay } from '@/lib/time-utils';

type Block = { id: string; startAt: string; energyLevel: number | null; taskId: string | null };
type Task = { id: string; categoryId: string | null };
type Category = { id: string; name: string; color: string };

const ENERGY_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😴', label: 'Drained' },
  2: { emoji: '😐', label: 'Low' },
  3: { emoji: '🙂', label: 'OK' },
  4: { emoji: '😃', label: 'Good' },
  5: { emoji: '⚡', label: 'Peak' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Analyzes energy patterns across completed time blocks over the last 30 days. */
export function EnergyPatterns() {
  const [hourlyData, setHourlyData] = useState<Array<{ hour: number; avgEnergy: number; count: number }> | null>(null);
  const [dailyData, setDailyData] = useState<Array<{ day: number; avgEnergy: number; count: number }> | null>(null);
  const [categoryData, setCategoryData] = useState<Array<{ name: string; color: string; avgEnergy: number; count: number }> | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = addDays(today, -30);

    Promise.all([
      apiFetch<Block[]>(`/api/time-blocks?from=${thirtyDaysAgo.toISOString()}&to=${today.toISOString()}`),
      apiFetch<Task[]>('/api/tasks'),
      apiFetch<Category[]>('/api/categories'),
    ])
      .then(([blocks, tasks, categories]) => {
        // Build task→category map
        const taskCategoryMap = new Map<string, string | null>();
        tasks.forEach(t => taskCategoryMap.set(t.id, t.categoryId));

        // Build category ID→name/color map
        const categoryMap = new Map(categories.map(c => [c.id, c]));

        // Hourly analysis
        const hourlyMap = new Map<number, { sum: number; count: number }>();
        // Daily analysis
        const dailyMap = new Map<number, { sum: number; count: number }>();
        // Category analysis
        const categoryMap_analysis = new Map<string, { sum: number; count: number }>();

        const newInsights: string[] = [];

        blocks.forEach(b => {
          if (b.energyLevel == null) return;

          const date = new Date(b.startAt);
          const hour = date.getHours();
          const day = date.getDay();

          // Hourly
          const hourlyExisting = hourlyMap.get(hour) ?? { sum: 0, count: 0 };
          hourlyMap.set(hour, { sum: hourlyExisting.sum + b.energyLevel, count: hourlyExisting.count + 1 });

          // Daily
          const dailyExisting = dailyMap.get(day) ?? { sum: 0, count: 0 };
          dailyMap.set(day, { sum: dailyExisting.sum + b.energyLevel, count: dailyExisting.count + 1 });

          // Category
          if (b.taskId) {
            const categoryId = taskCategoryMap.get(b.taskId);
            if (categoryId) {
              const catExisting = categoryMap_analysis.get(categoryId) ?? { sum: 0, count: 0 };
              categoryMap_analysis.set(categoryId, { sum: catExisting.sum + b.energyLevel, count: catExisting.count + 1 });
            }
          }
        });

        // Convert maps to arrays
        const hourly = Array.from(hourlyMap.entries())
          .map(([hour, { sum, count }]) => ({ hour, avgEnergy: sum / count, count }))
          .sort((a, b) => a.hour - b.hour);

        const daily = Array.from(dailyMap.entries())
          .map(([day, { sum, count }]) => ({ day, avgEnergy: sum / count, count }))
          .sort((a, b) => a.day - b.day);

        const category = Array.from(categoryMap_analysis.entries())
          .map(([catId, { sum, count }]) => {
            const cat = categoryMap.get(catId);
            return cat ? { name: cat.name, color: cat.color, avgEnergy: sum / count, count } : null;
          })
          .filter((c): c is { name: string; color: string; avgEnergy: number; count: number } => c !== null)
          .sort((a, b) => b.avgEnergy - a.avgEnergy);

        // Generate insights
        if (hourly.length > 0) {
          const bestHour = hourly.reduce((best, curr) => curr.avgEnergy > best.avgEnergy ? curr : best);
          const worstHour = hourly.reduce((worst, curr) => curr.avgEnergy < worst.avgEnergy ? curr : worst);
          newInsights.push(`Peak energy at ${bestHour.hour}:00, lowest at ${worstHour.hour}:00`);
        }

        if (daily.length > 0) {
          const bestDay = daily.reduce((best, curr) => curr.avgEnergy > best.avgEnergy ? curr : best);
          newInsights.push(`Best day: ${DAY_NAMES[bestDay.day]}`);
        }

        if (category.length > 0) {
          const highestCat = category[0];
          const lowestCat = category[category.length - 1];
          newInsights.push(`High energy for "${highestCat.name}" tasks`);
          if (category.length > 1 && lowestCat.avgEnergy < 3) {
            newInsights.push(`Consider scheduling "${lowestCat.name}" during peak hours`);
          }
        }

        setHourlyData(hourly);
        setDailyData(daily);
        setCategoryData(category);
        setInsights(newInsights);
      })
      .catch(() => {
        setHourlyData(null);
        setDailyData(null);
        setCategoryData(null);
      })
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
      <CardContent className="space-y-4">
        {/* Insights */}
        {insights.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            {insights.map((insight, i) => (
              <p key={i} className="text-xs text-muted-foreground">💡 {insight}</p>
            ))}
          </div>
        )}

        {/* Hourly patterns */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">By hour of day</p>
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

        {/* Daily patterns */}
        {dailyData && dailyData.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">By day of week</p>
            <div className="grid grid-cols-7 gap-1">
              {dailyData.map(d => (
                <div key={d.day} className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">{DAY_NAMES[d.day]}</div>
                  <div
                    className="h-12 rounded flex items-center justify-center text-lg"
                    style={{
                      backgroundColor: d.avgEnergy >= 4 ? '#22c55e' : d.avgEnergy >= 3 ? '#eab308' : '#ef4444',
                      opacity: 0.3 + (d.avgEnergy / 5) * 0.7,
                    }}
                    title={`${DAY_NAMES[d.day]}: ${d.avgEnergy.toFixed(1)} (${d.count} blocks)`}
                  >
                    {ENERGY_LABELS[Math.round(d.avgEnergy)].emoji}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category patterns */}
        {categoryData && categoryData.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">By task category</p>
            <div className="space-y-1">
              {categoryData.map(cat => (
                <div key={cat.name} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div className="flex-1 text-xs">{cat.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {ENERGY_LABELS[Math.round(cat.avgEnergy)].emoji} {cat.avgEnergy.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Based on {hourlyData.reduce((s, d) => s + d.count, 0)} completed blocks with energy ratings.
        </p>
      </CardContent>
    </Card>
  );
}
