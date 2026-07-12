import { Calendar, TrendingUp, Edit3, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore } from 'date-fns';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  period: string;
  status: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  color: string;
  category: string | null;
  startDate: string;
  endDate: string;
  linkedTaskIds: string[];
  linkedHabitIds: string[];
}

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onProgressUpdate: (goalId: string, newValue: number) => void;
}

export function GoalCard({ goal, onEdit, onDelete, onProgressUpdate }: GoalCardProps) {
  const progressPercent = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
  const isCompleted = goal.status === 'completed';
  const isActive = goal.status === 'active';
  const isPaused = goal.status === 'paused';

  const now = new Date();
  const startDate = new Date(goal.startDate);
  const endDate = new Date(goal.endDate);
  const isFuture = isBefore(now, startDate);
  const isExpired = isAfter(now, endDate);

  const statusVariant = isCompleted ? 'default' : isActive ? 'secondary' : 'outline';
  const statusLabel = isCompleted ? 'Completed' : isActive ? 'Active' : isPaused ? 'Paused' : 'Archived';

  const handleIncrement = () => {
    if (isActive && !isCompleted && goal.currentValue < goal.targetValue) {
      onProgressUpdate(goal.id, goal.currentValue + 1);
    }
  };

  const handleDecrement = () => {
    if (isActive && goal.currentValue > 0) {
      onProgressUpdate(goal.id, goal.currentValue - 1);
    }
  };

  return (
    <Card className={cn('relative overflow-hidden', isCompleted && 'border-green-500/50')}>
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: goal.color }}
      />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{goal.title}</CardTitle>
              <Badge variant={statusVariant} className="text-xs">
                {statusLabel}
              </Badge>
              {isFuture && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="mr-1 h-3 w-3" />
                  Future
                </Badge>
              )}
              {isExpired && !isCompleted && (
                <Badge variant="destructive" className="text-xs">
                  Expired
                </Badge>
              )}
            </div>
            {goal.description && (
              <CardDescription className="text-sm">{goal.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(goal)}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => onDelete(goal.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Progress
            </span>
            <span className="font-medium">
              {goal.currentValue} / {goal.targetValue}
              {goal.unit && ` ${goal.unit}`}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progressPercent}% complete</span>
            {isActive && (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleDecrement}
                  disabled={goal.currentValue <= 0}
                >
                  -
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleIncrement}
                  disabled={goal.currentValue >= goal.targetValue}
                >
                  +
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(startDate, 'MMM d')}</span>
            <span>→</span>
            <span>{format(endDate, 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span className="capitalize">{goal.period}</span>
          </div>
        </div>

        {(goal.linkedTaskIds.length > 0 || goal.linkedHabitIds.length > 0) && (
          <div className="text-xs text-muted-foreground">
            <div className="flex gap-4">
              {goal.linkedTaskIds.length > 0 && (
                <span>{goal.linkedTaskIds.length} task{goal.linkedTaskIds.length > 1 ? 's' : ''} linked</span>
              )}
              {goal.linkedHabitIds.length > 0 && (
                <span>{goal.linkedHabitIds.length} habit{goal.linkedHabitIds.length > 1 ? 's' : ''} linked</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}