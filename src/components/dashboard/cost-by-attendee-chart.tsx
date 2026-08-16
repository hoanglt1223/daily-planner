import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';

interface CostByAttendeeChartProps {
  from: Date;
  to: Date;
}

export function CostByAttendeeChart({ from, to }: CostByAttendeeChartProps) {
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

  if (loading || !data?.recentMeetings) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        {loading ? 'Loading...' : 'No data available'}
      </div>
    );
  }

  // Group recent meetings by type/status for the chart
  const typeGroups = new Map<string, { totalCost: number; count: number }>();

  for (const meeting of data.recentMeetings) {
    const type = meeting.status || 'completed';
    const existing = typeGroups.get(type) || { totalCost: 0, count: 0 };
    existing.totalCost += meeting.cost || 0;
    existing.count += 1;
    typeGroups.set(type, existing);
  }

  const chartData = Array.from(typeGroups.entries()).map(([type, info]) => ({
    type: type.charAt(0).toUpperCase() + type.slice(1),
    totalCost: info.totalCost,
    count: info.count,
  }));

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <XAxis
          dataKey="type"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number, name: string) => [
            name === 'totalCost' ? `$${value.toFixed(2)}` : value,
            name === 'totalCost' ? 'Total Cost' : 'Meetings'
          ]}
          labelFormatter={(label: string) => `Type: ${label}`}
        />
        <Legend />
        <Bar dataKey="totalCost" name="Total Cost" radius={[4, 4, 0, 0]}>
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
