import { MeetingCostDashboard } from '@/components/dashboard/meeting-cost-dashboard';

export function MeetingCostsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meeting Cost Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track the financial impact of meetings and optimize your time allocation.
        </p>
      </div>
      <MeetingCostDashboard />
    </div>
  );
}
