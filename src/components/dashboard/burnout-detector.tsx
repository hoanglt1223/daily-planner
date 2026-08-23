import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Shield, Activity, Calendar, Clock, Moon, Sunset, Brain, TrendingDown, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type BurnoutRiskResponse = {
  from: string;
  to: string;
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  factors: {
    workIntensity: {
      score: number;
      avgDailyWorkHours: number;
      maxDailyHours: number;
      overtimeDays: number;
    };
    energyTrend: {
      score: number;
      declining: boolean;
      avgEnergyLevel: number;
      recentEnergyAvg: number;
      earlierEnergyAvg: number;
    };
    vacationBalance: {
      score: number;
      daysUsed: number;
      daysAvailable: number;
      daysSinceBreak: number;
      needsVacation: boolean;
    };
    workLifeBalance: {
      score: number;
      weekendWork: number;
      eveningWork: number;
      lateNightWork: number;
    };
  };
  insights: string[];
  recommendations: string[];
  earlyWarnings: string[];
};

export function BurnoutDetector() {
  const [data, setData] = useState<BurnoutRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const from = new Date();
        from.setDate(from.getDate() - 30); // Last 30 days minimum
        const to = new Date();
        to.setDate(to.getDate() + 1);

        const response = await fetch(
          `/api/reports/burnout-risk?from=${from.toISOString()}&to=${to.toISOString()}`
        );
        if (!response.ok) throw new Error('Failed to fetch burnout risk data');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Burnout Risk Detector
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const riskConfig = {
    low: { color: 'text-green-600', bg: 'bg-green-500', icon: Shield, label: 'Low Risk' },
    moderate: { color: 'text-yellow-600', bg: 'bg-yellow-500', icon: Activity, label: 'Moderate Risk' },
    high: { color: 'text-orange-600', bg: 'bg-orange-500', icon: AlertTriangle, label: 'High Risk' },
    critical: { color: 'text-red-600', bg: 'bg-red-500', icon: XCircle, label: 'Critical Risk' },
  }[data.riskLevel];

  const RiskIcon = riskConfig.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiskIcon className={`h-5 w-5 ${riskConfig.color}`} />
          Burnout Risk Detector
        </CardTitle>
        <CardDescription>Work-life balance & burnout prevention insights</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Risk Score */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Overall Risk Score</p>
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-bold ${riskConfig.color}`}>
                {data.riskScore}
              </span>
              <Badge variant="outline" className={cn(riskConfig.color, 'border-current')}>
                {riskConfig.label}
              </Badge>
            </div>
          </div>
          <div className="space-y-1 w-1/3">
            <Progress value={data.riskScore} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">0-100 scale</p>
          </div>
        </div>

        {/* Factor Breakdown */}
        <div className="space-y-4">
          <p className="text-sm font-medium">Risk Factors</p>

          <FactorRow
            icon={Clock}
            label="Work Intensity"
            score={data.factors.workIntensity.score}
            details={`${data.factors.workIntensity.avgDailyWorkHours}h avg / ${data.factors.workIntensity.maxDailyHours}h max`}
            highlight={data.factors.workIntensity.overtimeDays > 0}
            warning={`${data.factors.workIntensity.overtimeDays} overtime days`}
          />

          <FactorRow
            icon={Brain}
            label="Energy Trend"
            score={data.factors.energyTrend.score}
            details={`${data.factors.energyTrend.avgEnergyLevel}/5 avg energy`}
            highlight={data.factors.energyTrend.declining}
            warning="Energy declining over time"
          />

          <FactorRow
            icon={Calendar}
            label="Vacation Balance"
            score={data.factors.vacationBalance.score}
            details={`${data.factors.vacationBalance.daysUsed} used / ${data.factors.vacationBalance.daysAvailable} available`}
            highlight={data.factors.vacationBalance.needsVacation}
            warning={`${data.factors.vacationBalance.daysSinceBreak} days since break`}
          />

          <FactorRow
            icon={Moon}
            label="Work-Life Balance"
            score={data.factors.workLifeBalance.score}
            details={`${data.factors.workLifeBalance.weekendWork} weekend + ${data.factors.workLifeBalance.eveningWork} evening blocks`}
            highlight={data.factors.workLifeBalance.weekendWork > 0 || data.factors.workLifeBalance.eveningWork > 4}
            warning={`${data.factors.workLifeBalance.weekendWork} weekend work days`}
          />
        </div>

        {/* Early Warnings */}
        {data.earlyWarnings.length > 0 && (
          <div className="space-y-2 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-medium">Early Warnings</p>
            </div>
            <ul className="space-y-1">
              {data.earlyWarnings.map((warning, i) => (
                <li key={i} className="text-sm text-red-600 dark:text-red-500 flex items-start gap-2">
                  <span className="text-red-800 dark:text-red-400 mt-0.5">•</span>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Key Insights</p>
            <ul className="space-y-1">
              {data.insights.map((insight, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium">Recommended Actions</p>
            </div>
            <ul className="space-y-1">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FactorRow({
  icon: Icon,
  label,
  score,
  details,
  highlight,
  warning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  score: number;
  details: string;
  highlight: boolean;
  warning: string;
}) {
  const scoreColor = score >= 70 ? 'text-red-600' : score >= 40 ? 'text-yellow-600' : 'text-green-600';
  const bgColor = score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-md', highlight ? 'bg-muted/50' : '')}>
      <div className={cn('rounded-md p-1.5', highlight ? 'bg-primary/10' : 'bg-muted')}>
        <Icon className={cn('h-4 w-4', highlight ? 'text-primary' : 'text-muted-foreground')} />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{label}</p>
          <span className={cn('text-sm font-semibold', scoreColor)}>{score}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={score} className={cn('h-1.5 flex-1', bgColor)} />
        </div>
        <p className="text-xs text-muted-foreground">{details}</p>
        {highlight && (
          <p className="text-xs text-orange-600 dark:text-orange-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {warning}
          </p>
        )}
      </div>
    </div>
  );
}
