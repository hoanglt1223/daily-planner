import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, Clock, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type MeetingCostsResponse = {
  from: string;
  to: string;
  summary: {
    totalMeetings: number;
    totalMeetingMinutes: number;
    totalCost: number;
    avgCostPerMeeting: number;
    avgCostPerHour: number;
    mostExpensiveMeeting: {
      title: string;
      cost: number;
      duration: number;
      date: string;
    } | null;
  };
  byPeriod: Array<{
    date: string;
    meetingCount: number;
    totalMinutes: number;
    totalCost: number;
  }>;
  recentMeetings: Array<{
    id: string;
    title: string;
    startAt: string;
    duration: number;
    participantCount: number;
    cost: number;
    status: string;
  }>;
  insights: string[];
};

export function MeetingCostAnalytics() {
  const [data, setData] = useState<MeetingCostsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();

    apiFetch<MeetingCostsResponse>(
      `/api/reports/meeting-costs?from=${from.toISOString()}&to=${to.toISOString()}`
    )
      .then(setData)
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meeting Cost Analytics</CardTitle>
          <CardDescription>Track meeting expenses and optimize time</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load meeting cost data.</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, insights, recentMeetings } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Meeting Cost Analytics
        </CardTitle>
        <CardDescription>30-day meeting cost overview and insights</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Total Cost
            </div>
            <div className="text-2xl font-bold text-green-600">
              ${summary.totalCost.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              {summary.totalMeetings} meetings
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Avg Cost/Hour
            </div>
            <div className="text-2xl font-bold">
              ${summary.avgCostPerHour}
            </div>
            <div className="text-xs text-muted-foreground">
              ${summary.avgCostPerMeeting}/meeting
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Total Time
            </div>
            <div className="text-2xl font-bold">
              {Math.round(summary.totalMeetingMinutes / 60)}h
            </div>
            <div className="text-xs text-muted-foreground">
              {summary.totalMeetingMinutes} minutes
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Most Expensive</div>
            <div className="text-lg font-semibold text-orange-600">
              {summary.mostExpensiveMeeting ? `$${summary.mostExpensiveMeeting.cost}` : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[120px]">
              {summary.mostExpensiveMeeting?.title || 'No meetings'}
            </div>
          </div>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Insights</h4>
            <div className="space-y-1">
              {insights.map((insight, idx) => (
                <div key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Meetings */}
        {recentMeetings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Meetings</h4>
            <div className="space-y-1">
              {recentMeetings.slice(0, 5).map(meeting => (
                <div key={meeting.id} className="flex items-center justify-between text-xs p-2 rounded hover:bg-muted/50">
                  <div className="flex-1 truncate mr-2">
                    <div className="font-medium truncate">{meeting.title}</div>
                    <div className="text-muted-foreground">
                      {new Date(meeting.startAt).toLocaleDateString()} • {meeting.duration}min
                    </div>
                  </div>
                  <Badge variant="outline" className="font-normal">
                    ${meeting.cost}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
