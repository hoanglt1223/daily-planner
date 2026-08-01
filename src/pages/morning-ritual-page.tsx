import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sun,
  Coffee,
  CheckCircle2,
  Target,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { startOfDay, addDays, fmtHour } from '@/lib/time-utils';
import { toast } from 'sonner';

/* ─── Types ─── */

type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done' | 'archived';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: number;
  estimatedMinutes: number;
  dueDate: string | null;
  categoryId: string | null;
  projectId: string | null;
}

interface Block {
  id: string;
  taskId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
}

interface MorningPrompt {
  id: number;
  prompt: string;
  category: 'focus' | 'intention' | 'gratitude' | 'energy';
}

/* ─── Constants ─── */

const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  3: { label: 'Normal', cls: 'bg-muted text-muted-foreground border-border' },
  4: { label: 'Low', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  5: { label: 'Someday', cls: 'bg-muted text-muted-foreground border-border' },
};

const MORNING_PROMPTS: MorningPrompt[] = [
  { id: 1, prompt: 'What is the ONE thing you must accomplish today?', category: 'focus' },
  { id: 2, prompt: 'How do you want to feel at the end of today?', category: 'intention' },
  { id: 3, prompt: 'What are you grateful for this morning?', category: 'gratitude' },
  { id: 4, prompt: 'What will give you the most energy today?', category: 'energy' },
  { id: 5, prompt: 'What can you do today that your future self will thank you for?', category: 'focus' },
  { id: 6, prompt: 'What challenge will you overcome today?', category: 'intention' },
  { id: 7, prompt: 'Who can you help or inspire today?', category: 'gratitude' },
  { id: 8, prompt: 'What small win can you celebrate today?', category: 'energy' },
];

const GREETINGS = [
  'Rise and shine!',
  'Good morning!',
  'Let\'s make today count!',
  'Ready to crush it?',
  'New day, new possibilities!',
];

/* ─── Page ─── */

export function MorningRitualPage() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [topThreeIds, setTopThreeIds] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);
  const [prompt, setPrompt] = useState<MorningPrompt>(() =>
    MORNING_PROMPTS[Math.floor(Math.random() * MORNING_PROMPTS.length)]
  );
  const [greeting] = useState(() =>
    GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
  );
  const [reflection, setReflection] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const todayStart = startOfDay(new Date());
      const todayEnd = addDays(todayStart, 1);
      const [blocksData, tasksData] = await Promise.all([
        apiFetch<Block[]>(`/api/time-blocks?from=${todayStart.toISOString()}&to=${todayEnd.toISOString()}`),
        apiFetch<Task[]>('/api/tasks'),
      ]);
      setBlocks(blocksData);
      setTasks(tasksData.filter(t => t.status !== 'done' && t.status !== 'archived'));
    } catch (err) {
      toast.error('Failed to load today\'s data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-select top 3 on initial load
  useEffect(() => {
    if (tasks.length > 0 && topThreeIds.size === 0) {
      const suggested = suggestTopThree(tasks);
      setTopThreeIds(new Set(suggested.map(t => t.id)));
    }
  }, [tasks, topThreeIds.size]);

  const topThree = useMemo(
    () => tasks.filter(t => topThreeIds.has(t.id)),
    [tasks, topThreeIds]
  );

  const scheduledMinutes = useMemo(() => {
    return blocks.reduce((sum, b) => {
      const start = new Date(b.startAt).getTime();
      const end = new Date(b.endAt).getTime();
      return sum + Math.round((end - start) / 60_000);
    }, 0);
  }, [blocks]);

  const handleTaskToggle = (taskId: string) => {
    setCompleted(false);
    setTopThreeIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else if (next.size < 3) {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleCompleteRitual = async () => {
    if (topThreeIds.size === 0) {
      toast.error('Please select at least one top priority');
      return;
    }
    setCompleted(true);
    toast.success('Morning ritual complete! Have an amazing day!');
    setTimeout(() => navigate('/dashboard'), 1500);
  };

  const handleNewPrompt = () => {
    const available = MORNING_PROMPTS.filter(p => p.id !== prompt.id);
    setPrompt(available[Math.floor(Math.random() * available.length)]);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sun className="size-6 text-amber-500" />
          <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
        </div>
        <p className="text-muted-foreground">
          Take a moment to set your intentions and priorities for the day ahead.
        </p>
      </div>

      {/* Today at a Glance */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="size-4 text-primary" />
            <h2 className="text-lg font-semibold">Today's Schedule</h2>
          </div>

          {blocks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No time blocks scheduled today</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate('/planner')}
              >
                Plan your day
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {blocks.length} block{blocks.length !== 1 ? 's' : ''} · {fmtHour(new Date(blocks[0].startAt))} – {fmtHour(new Date(blocks[blocks.length - 1].endAt))}
                </span>
                <span className="font-medium">{scheduledMinutes}m scheduled</span>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 mt-3">
                {blocks.map(b => (
                  <div key={b.id} className="flex items-center gap-3 text-sm py-1 px-2 rounded hover:bg-muted/50">
                    <Clock className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">
                      {fmtHour(new Date(b.startAt))}
                    </span>
                    <span className={cn(
                      'truncate',
                      b.status === 'completed' && 'line-through text-muted-foreground'
                    )}>
                      {b.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 3 Priorities */}
      <Card className={cn(
        'ring-2 transition-all',
        completed ? 'ring-emerald-200 bg-emerald-50/50' : 'ring-primary/20'
      )}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              <h2 className="text-lg font-semibold">Your Top 3 Priorities</h2>
            </div>
            <Badge variant="secondary" className="text-xs">
              {topThreeIds.size}/3 selected
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Select the 3 most important tasks to focus on today. These will be your north star.
          </p>

          {/* Selected tasks */}
          <div className="space-y-2">
            {[0, 1, 2].map((slot) => {
              const task = topThree[slot];
              return (
                <div
                  key={slot}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border-2 transition-all',
                    task ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/25'
                  )}
                >
                  <div className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0',
                    task ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    {slot + 1}
                  </div>

                  {task ? (
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', PRIORITY_LABEL[task.priority].cls)}>
                          {PRIORITY_LABEL[task.priority].label}
                        </span>
                        {task.estimatedMinutes > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(task.estimatedMinutes / 60)}h {task.estimatedMinutes % 60}m
                          </span>
                        )}
                        {task.dueDate && isToday(task.dueDate) && (
                          <Badge variant="outline" className="text-[10px] h-5">Due today</Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 text-sm text-muted-foreground">
                      {slot === 0 ? 'Your #1 priority for today' :
                       slot === 1 ? 'Second most important task' :
                       'Third key focus area'}
                    </div>
                  )}

                  {task && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => handleTaskToggle(task.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Task selector */}
          {topThreeIds.size < 3 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Add from your tasks:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                {tasks
                  .filter(t => !topThreeIds.has(t.id))
                  .slice(0, 10)
                  .map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskToggle(task.id)}
                      className="w-full flex items-center gap-3 text-sm p-2 rounded hover:bg-muted/50 text-left"
                    >
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', PRIORITY_LABEL[task.priority].cls)}>
                        {PRIORITY_LABEL[task.priority].label}
                      </span>
                      <span className="truncate flex-1">{task.title}</span>
                      {task.dueDate && isToday(task.dueDate) && (
                        <Badge variant="outline" className="text-[9px] h-4 shrink-0">Today</Badge>
                      )}
                      <CheckCircle2 className="size-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                {tasks.filter(t => !topThreeIds.has(t.id)).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No more tasks available</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Morning Reflection */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-500" />
              <h2 className="text-lg font-semibold">Morning Reflection</h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleNewPrompt}
            >
              New prompt
            </Button>
          </div>

          <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/50 p-4">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {prompt.prompt}
            </p>
          </div>

          <textarea
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="Take a moment to reflect..."
            className="w-full min-h-[80px] rounded-md border resize-none p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {reflection && (
            <p className="text-xs text-muted-foreground text-right">
              Your reflection will be saved to today's notes
            </p>
          )}
        </CardContent>
      </Card>

      {/* Complete Ritual */}
      <Button
        size="lg"
        className="w-full h-12 text-base"
        onClick={handleCompleteRitual}
        disabled={topThreeIds.size === 0 || completed}
      >
        {completed ? (
          <>
            <CheckCircle2 className="size-5 mr-2" />
            Ritual Complete!
          </>
        ) : (
          <>
            <Sparkles className="size-5 mr-2" />
            Start My Day
            <ArrowRight className="size-5 ml-2" />
          </>
        )}
      </Button>

      {completed && (
        <p className="text-center text-sm text-muted-foreground">
          Redirecting to dashboard...
        </p>
      )}
    </div>
  );
}

/* ─── Helpers ─── */

function suggestTopThree(tasks: Task[]): Task[] {
  const scored = tasks.map(task => {
    let score = 0;

    // Priority score (inverse)
    score += (6 - task.priority) * 10;

    // Due today bonus
    if (task.dueDate && isToday(task.dueDate)) {
      score += 20;
    }

    // Overdue penalty (lower priority)
    if (task.dueDate && new Date(task.dueDate) < startOfDay(new Date())) {
      score += 15;
    }

    // Already in progress bonus
    if (task.status === 'doing') {
      score += 15;
    }

    return { task, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(s => s.task);
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  return date >= today && date < tomorrow;
}
