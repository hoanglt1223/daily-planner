import { useEffect, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface CostOverTimeChartProps {
  from: Date;
  to: Date;
}

export function CostOverTimeChart({ from, to }: CostOverTimeChartProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const searchParams = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    fetch(`/api/reports?kind=meeting-costs&${searchParams}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to]);

  if (loading || !data?.byPeriod) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {loading ? 'Loading...' : 'No data available'}
      </div>
    );
  }

  const chartData = (data.byPeriod || [])
    .map((period: any) => ({
      date: new Date(period.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cost: period.totalCost || 0,
    }))
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number | undefined) => [`$${(value || 0).toFixed(2)}`, 'Daily Cost']}
          labelFormatter={(label: React.ReactNode) => `Date: ${label}`}
        />
        <Line
          type="monotone"
          dataKey="cost"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
