import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react';

interface MeetingCostInsightsProps {
  from: Date;
  to: Date;
}

export function MeetingCostInsights({ from, to }: MeetingCostInsightsProps) {
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

  if (loading || !data) {
    return (
      <div className="text-sm text-muted-foreground">
        {loading ? 'Loading insights...' : 'No insights available for this period.'}
      </div>
    );
  }

  const insights = generateInsights(data);

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => (
        <Alert key={index} variant={insight.variant as any}>
          {insight.icon}
          <AlertTitle className="text-sm font-medium">
            {insight.title}
          </AlertTitle>
          <AlertDescription className="text-xs">
            {insight.description}
          </AlertDescription>
        </Alert>
      ))}
      {data.summary?.mostExpensiveMeeting && (
        <Alert variant="default">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">
            Most Expensive Meeting
          </AlertTitle>
          <AlertDescription className="text-xs">
            {data.summary.mostExpensiveMeeting.title} - $
            {data.summary.mostExpensiveMeeting.cost?.toFixed(2)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface Insight {
  variant: 'default' | 'destructive' | 'warning';
  icon: React.ReactNode;
  title: string;
  description: string;
}

function generateInsights(data: any): Insight[] {
  const insights: Insight[] = [];
  const summary = data.summary || {};
  const apiInsights = data.insights || [];

  // Convert API insights to UI insights
  for (const apiInsight of apiInsights) {
    insights.push({
      variant: 'default',
      icon: <Info className="h-4 w-4" />,
      title: 'Meeting Cost Insight',
      description: apiInsight,
    });
  }

  const totalCost = summary.totalCost || 0;
  const totalHours = (summary.totalMeetingMinutes || 0) / 60;
  const avgCost = summary.avgCostPerMeeting || 0;
  const meetingCount = summary.totalMeetings || 0;

  if (totalCost > 10000) {
    insights.push({
      variant: 'destructive',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: 'High Meeting Costs',
      description: `Total meeting costs of $${totalCost.toFixed(2)} indicate significant resource allocation.`,
    });
  } else if (totalCost > 5000) {
    insights.push({
      variant: 'warning',
      icon: <TrendingUp className="h-4 w-4" />,
      title: 'Moderate Meeting Costs',
      description: `Meeting costs of $${totalCost.toFixed(2)} are notable but within acceptable range.`,
    });
  } else if (totalCost > 0) {
    insights.push({
      variant: 'default',
      icon: <TrendingDown className="h-4 w-4" />,
      title: 'Efficient Meeting Usage',
      description: `Meeting costs of $${totalCost.toFixed(2)} show good cost control.`,
    });
  }

  if (totalHours > 40) {
    insights.push({
      variant: 'destructive',
      icon: <AlertTriangle className="h-4 w-4" />,
      title: 'Excessive Meeting Time',
      description: `${totalHours.toFixed(1)}h spent in meetings may impact deep work capacity.`,
    });
  }

  if (avgCost > 500) {
    insights.push({
      variant: 'warning',
      icon: <TrendingUp className="h-4 w-4" />,
      title: 'High Average Cost per Meeting',
      description: `Average meeting cost of $${avgCost.toFixed(2)} suggests large or lengthy meetings.`,
    });
  }

  if (meetingCount > 50) {
    insights.push({
      variant: 'warning',
      icon: <Info className="h-4 w-4" />,
      title: 'High Meeting Frequency',
      description: `${meetingCount} meetings in this period - consider consolidating.`,
    });
  }

  return insights.slice(0, 6);
}
