import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CostByAttendeeChart } from './cost-by-attendee-chart';
import { MeetingCostInsights } from './meeting-cost-insights';
import { CostOverTimeChart } from './cost-over-time-chart';

interface MeetingCostDashboardProps {
  from?: Date;
  to?: Date;
}

export function MeetingCostDashboard({ from, to }: MeetingCostDashboardProps) {
  const toDate = to || new Date();
  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days

  return (
    <div className="space-y-4">
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">By Meeting Type</TabsTrigger>
          <TabsTrigger value="attendees">By Attendee</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Meeting Cost</CardTitle>
                <span className="text-2xl">💰</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <CostDisplay from={fromDate} to={toDate} type="total" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Total cost of all meetings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meeting Hours</CardTitle>
                <span className="text-2xl">⏱️</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <CostDisplay from={fromDate} to={toDate} type="hours" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Total time in meetings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Cost/Meeting</CardTitle>
                <span className="text-2xl">📊</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <CostDisplay from={fromDate} to={toDate} type="average" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Average cost per meeting
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meetings Count</CardTitle>
                <span className="text-2xl">👥</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <CostDisplay from={fromDate} to={toDate} type="count" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Total number of meetings
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cost Over Time</CardTitle>
                <CardDescription>Meeting costs trend over the period</CardDescription>
              </CardHeader>
              <CardContent>
                <CostOverTimeChart from={fromDate} to={toDate} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
                <CardDescription>Analysis and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <MeetingCostInsights from={fromDate} to={toDate} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Meeting Type</CardTitle>
              <CardDescription>Breakdown of costs by booking event type</CardDescription>
            </CardHeader>
            <CardContent>
              <CostByAttendeeChart from={fromDate} to={toDate} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Attendee</CardTitle>
              <CardDescription>Individual meeting cost contributions</CardDescription>
            </CardHeader>
              <CardContent>
                <CostByAttendeeChart from={fromDate} to={toDate} />
              </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CostDisplay({ from, to, type }: { from: Date; to: Date; type: 'total' | 'hours' | 'average' | 'count' }) {
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
    return <span className="text-muted-foreground">--</span>;
  }

  switch (type) {
    case 'total':
      return <span>${data.summary?.totalCost?.toFixed(2) || '0.00'}</span>;
    case 'hours':
      return <span>{((data.summary?.totalMeetingMinutes || 0) / 60).toFixed(1)}h</span>;
    case 'average':
      return <span>${data.summary?.avgCostPerMeeting?.toFixed(2) || '0.00'}</span>;
    case 'count':
      return <span>{data.summary?.totalMeetings || 0}</span>;
    default:
      return <span>--</span>;
  }
}
