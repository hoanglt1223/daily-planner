import { useEffect, useState } from 'react';
import { Trophy, Flame, CheckCircle2, Award, Zap, Star } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface AchievementProgress {
  achievementId: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  points: number;
  isSecret: boolean;
  progress: {
    current: number;
    target: number;
    percentage: number;
  };
}

interface AchievementsDialogProps {
  onClose?: () => void;
}

export function AchievementsDialog({ onClose }: AchievementsDialogProps) {
  const [progress, setProgress] = useState<AchievementProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AchievementProgress[]>('/api/achievements?action=progress');
      setProgress(data);
    } catch (error) {
      console.error('Failed to load achievement progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const unlockedCount = progress.filter(a => a.progress.percentage >= 100).length;
  const totalPoints = progress
    .filter(a => a.progress.percentage >= 100)
    .reduce((sum, a) => sum + a.points, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-20 flex-1" />
          <Skeleton className="h-20 flex-1" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-100 p-3">
                <Trophy className="size-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Achievements Unlocked</p>
                <p className="text-2xl font-bold">{unlockedCount} / {progress.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 p-3">
                <Award className="size-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold">{totalPoints}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Achievements */}
      <div className="space-y-3">
        {progress.map(achievement => (
          <AchievementCard key={achievement.achievementId} achievement={achievement} />
        ))}

        {progress.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Trophy className="size-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No achievements available yet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Button onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: AchievementProgress }) {
  const isUnlocked = achievement.progress.percentage >= 100;

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      isUnlocked && "border-yellow-200 bg-gradient-to-r from-yellow-50/50 to-transparent"
    )}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            "rounded-full p-3 text-2xl flex-shrink-0",
            isUnlocked ? "bg-yellow-100" : "bg-muted"
          )}>
            {achievement.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className={cn(
                "font-semibold",
                isUnlocked ? "text-yellow-900" : "text-muted-foreground"
              )}>
                {achievement.name}
              </h4>
              <Badge variant={isUnlocked ? "default" : "secondary"} className="shrink-0">
                {achievement.points} pts
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-3">
              {achievement.description}
            </p>

            {/* Progress Bar */}
            {!isUnlocked && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{achievement.progress.current} / {achievement.progress.target}</span>
                </div>
                <Progress value={achievement.progress.percentage} className="h-2" />
              </div>
            )}

            {isUnlocked && (
              <div className="flex items-center gap-2 text-sm text-yellow-700">
                <CheckCircle2 className="size-4" />
                <span className="font-medium">Unlocked!</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}