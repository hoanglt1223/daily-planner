import { useEffect, useState } from 'react';
import { Trophy, Star } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AchievementsDialog } from '@/components/achievements-dialog';

interface AchievementStats {
  totalUnlocked: number;
  totalPoints: number;
  recent: Array<{
    name: string;
    icon: string;
    color: string;
    points: number;
    unlockedAt: string;
  }>;
}

export function AchievementsBadge() {
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newAchievements, setNewAchievements] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    checkNewAchievements();
  }, []);

  const loadStats = async () => {
    try {
      const data = await apiFetch<AchievementStats>('/api/achievements?action=stats');
      setStats(data);
    } catch (error) {
      console.error('Failed to load achievement stats:', error);
    }
  };

  const checkNewAchievements = async () => {
    try {
      const data = await apiFetch<{ unlocked: any[] }>('/api/achievements?action=check', {
        method: 'POST',
      });

      if (data.unlocked && data.unlocked.length > 0) {
        setNewAchievements(data.unlocked);
        setShowDialog(true);

        // Show toast for each new achievement
        data.unlocked.forEach((achievement, index) => {
          setTimeout(() => {
            toast.success(`Achievement Unlocked: ${achievement.icon} ${achievement.name}`, {
              description: achievement.description,
              duration: 5000,
            });
          }, index * 1500);
        });

        // Reload stats after unlocking
        setTimeout(loadStats, 2000);
      }
    } catch (error) {
      console.error('Failed to check achievements:', error);
    }
  };

  if (!stats) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Trophy className="size-4 text-yellow-500" />
        <span className="font-semibold">{stats.totalUnlocked}</span>
        <Badge variant="secondary" className="text-xs">
          {stats.totalPoints} pts
        </Badge>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="size-5 text-yellow-500" />
              Achievements
            </DialogTitle>
            <DialogDescription>
              Track your productivity milestones and earn rewards for consistent progress.
            </DialogDescription>
          </DialogHeader>

          {newAchievements.length > 0 && (
            <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="size-5 text-yellow-600" />
                  <h3 className="font-semibold text-yellow-900">New Achievements Unlocked!</h3>
                </div>
                <div className="space-y-2">
                  {newAchievements.map(achievement => (
                    <div key={achievement.id} className="flex items-center gap-3 p-2 bg-white rounded-lg">
                      <span className="text-2xl">{achievement.icon}</span>
                      <div className="flex-1">
                        <h4 className="font-semibold">{achievement.name}</h4>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      </div>
                      <Badge className="bg-yellow-500">+{achievement.points} pts</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <AchievementsDialog onClose={() => setShowDialog(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}