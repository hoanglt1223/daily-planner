import { useState, useEffect } from 'react';
import { Calendar, Plus, Settings, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type VacationStatus = {
  vacationDaysAvailable: number;
  vacationDaysUsed: number;
  vacationDaysAccrualRate: number;
  vacationAccrualLastReset: string | null;
  vacationBlocks: Array<{
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    status: string;
  }>;
};

export function VacationStatus() {
  const [data, setData] = useState<VacationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await apiFetch<VacationStatus>('/api/vacation?action=status');
      setData(response);
    } catch (e) {
      console.error('Failed to load vacation status:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Vacation Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="size-4" />
            Failed to load vacation status
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDays = data!.vacationDaysAvailable + data!.vacationDaysUsed;
  const usagePercentage = totalDays > 0 ? Math.round((data!.vacationDaysUsed / totalDays) * 100) : 0;
  const isLowBalance = data!.vacationDaysAvailable < 5;
  const upcomingVacations = data!.vacationBlocks
    .filter(b => new Date(b.startAt) > new Date() && b.status === 'planned')
    .slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5" />
              Vacation Balance
            </CardTitle>
            <CardDescription>
              Track and plan your time off
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/vacation">
              <Settings className="size-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance display */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-bold">{data!.vacationDaysAvailable}</span>
              <span className="text-sm text-muted-foreground ml-1">days available</span>
            </div>
            <Badge variant={isLowBalance ? "destructive" : "secondary"}>
              {data!.vacationDaysUsed} used this year
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isLowBalance ? "bg-destructive" : "bg-primary"
                )}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{usagePercentage}% used</span>
              <span>{totalDays} total days</span>
            </div>
          </div>
        </div>

        {/* Upcoming vacations preview */}
        {upcomingVacations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Upcoming Time Off</p>
            {upcomingVacations.map(vacation => (
              <div key={vacation.id} className="text-sm">
                <p className="font-medium">{vacation.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(vacation.startAt).toLocaleDateString()} - {new Date(vacation.endAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Low balance warning */}
        {isLowBalance && (
          <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-md">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              Low vacation balance remaining. Consider planning your next time off.
            </p>
          </div>
        )}

        {/* Quick action button */}
        <Button asChild className="w-full">
          <Link to="/vacation">
            <Plus className="size-4 mr-2" />
            Plan Vacation
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
