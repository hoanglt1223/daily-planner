import { useState, useEffect } from 'react';
import { Clock, Zap, TrendingUp, Lightbulb, Calendar, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type SmartScheduleRecommendation = {
  taskId: string;
  taskTitle: string;
  taskPriority: number;
  taskEstimatedMinutes: number;
  recommendedSlots: Array<{
    date: string;
    startTime: string;
    endTime: string;
    confidence: number;
    reasoning: string;
    energyLevel: number;
  }>;
  energyInsights: {
    peakHours: number[];
    lowHours: number[];
    pattern: string;
  };
};

interface SmartScheduleRecommendationsProps {
  taskId: string;
  onScheduleSlot?: (date: string, startTime: string, endTime: string) => void;
}

export function SmartScheduleRecommendations({ taskId, onScheduleSlot }: SmartScheduleRecommendationsProps) {
  const [data, setData] = useState<SmartScheduleRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecommendations();
  }, [taskId]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<SmartScheduleRecommendation>(`/api/reports?kind=smart-schedule&taskId=${taskId}`);
      setData(response);
    } catch (err) {
      console.error('Failed to load smart schedule:', err);
      setError('Failed to load schedule recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleSlot = (slot: SmartScheduleRecommendation['recommendedSlots'][0]) => {
    if (onScheduleSlot) {
      onScheduleSlot(slot.date, slot.startTime, slot.endTime);
    } else {
      // Copy to clipboard or show toast
      toast.success(`Schedule suggested: ${slot.date} ${slot.startTime}-${slot.endTime}`);
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-100 text-red-700 border-red-200';
      case 2: return 'bg-orange-100 text-orange-700 border-orange-200';
      case 3: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 4: return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return { label: 'High Confidence', variant: 'default' as const, badge: 'default' as const };
    if (confidence >= 60) return { label: 'Medium Confidence', variant: 'secondary' as const, badge: 'secondary' as const };
    return { label: 'Low Confidence', variant: 'outline' as const, badge: 'outline' as const };
  };

  const getPatternDescription = (pattern: string) => {
    switch (pattern) {
      case 'morning_person': return 'You perform best in the morning hours';
      case 'afternoon_focused': return 'Peak energy in afternoon hours';
      case 'night_owl': return 'Most productive in evening hours';
      case 'consistent': return 'Steady energy throughout the day';
      default: return 'Not enough data to determine pattern';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Smart Schedule Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-5" />
            Smart Schedule Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Lightbulb className="size-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{error || 'No recommendations available'}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={loadRecommendations}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confidenceBadgeResult = getConfidenceBadge(data.recommendedSlots[0]?.confidence || 0);

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="size-5 text-primary" />
          Smart Schedule Analysis
        </CardTitle>
        <CardDescription>
          AI-powered scheduling based on your energy patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Task Overview */}
        <div className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="font-medium">{data.taskTitle}</div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>{data.taskEstimatedMinutes} min</span>
              <Badge className={getPriorityColor(data.taskPriority)}>
                Priority {data.taskPriority}
              </Badge>
            </div>
          </div>
        </div>

        {/* Energy Insights */}
        {(data.energyInsights.peakHours.length > 0 || data.energyInsights.pattern !== 'insufficient_data') && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">Your Energy Pattern</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{getPatternDescription(data.energyInsights.pattern)}</p>
            {data.energyInsights.peakHours.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.energyInsights.peakHours.map(hour => (
                  <Badge key={hour} variant="secondary" className="text-xs">
                    {hour}:00
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">Peak hours</span>
              </div>
            )}
          </div>
        )}

        {/* Recommended Slots */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="size-4" />
              Recommended Time Slots
            </h3>
            <Badge variant={confidenceBadgeResult.variant} className="text-xs">
              {confidenceBadgeResult.label}
            </Badge>
          </div>

          {data.recommendedSlots.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No available time slots found. Check your existing schedule.
            </div>
          ) : (
            <div className="space-y-2">
              {data.recommendedSlots.map((slot, index) => {
                const confidenceResult = getConfidenceBadge(slot.confidence);
                return (
                  <div
                    key={`${slot.date}-${slot.startTime}`}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="size-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {slot.date} {slot.startTime}-{slot.endTime}
                          </span>
                          <Badge variant={confidenceResult.variant} className="text-xs">
                            {slot.confidence}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="size-3 text-yellow-500" />
                          <span className="text-xs text-muted-foreground">
                            Energy: {slot.energyLevel}/5
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{slot.reasoning}</p>
                      </div>
                      {index < 3 && onScheduleSlot && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleScheduleSlot(slot)}
                          className="text-xs"
                        >
                          Schedule
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <Lightbulb className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <strong className="text-amber-700 dark:text-amber-400">Tip:</strong> Continue tracking your energy levels after completing tasks to improve these recommendations.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}