import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Moon,
  CheckCircle2,
  Target,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Star,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { startOfDay, endOfDay } from '@/lib/time-utils';
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
  actualMinutes: number | null;
}

interface EveningPrompt {
  id: number;
  prompt: string;
  category: 'gratitude' | 'achievement' | 'learning' | 'tomorrow';
}

interface DailyNote {
  content: string;
  reflectionData: {
    mood?: string;
    wentWell?: string;
    toImprove?: string;
    tomorrowPriorities?: string;
  } | null;
}

/* ─── Constants ─── */

const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  3: { label: 'Normal', cls: 'bg-muted text-muted-foreground border-border' },
  4: { label: 'Low', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  5: { label: 'Someday', cls: 'bg-muted text-muted-foreground border-border' },
};

const EVENING_PROMPTS: EveningPrompt[] = [
  { id: 1, prompt: 'What went really well today?', category: 'achievement' },
  { id: 2, prompt: 'What are you grateful for today?', category: 'gratitude' },
  { id: 3, prompt: 'What did you learn today?', category: 'learning' },
  { id: 4, prompt: 'What will you do differently tomorrow?', category: 'tomorrow' },
  { id: 5, prompt: 'What moment made you smile today?', category: 'gratitude' },
  { id: 6, prompt: 'What challenged you today?', category: 'learning' },
  { id: 7, prompt: 'What are you proud of accomplishing?', category: 'achievement' },
  { id: 8, prompt: 'What do you need to let go of before sleep?', category: 'tomorrow' },
];

const EVENING_GREETINGS = [
  'Good evening!',
  'Time to wind down...',
  'Let\'s reflect on today...',
  'Evening check-in time.',
  'Ready to rest your mind?',
];

const MOOD_OPTIONS = ['😊', '😌', '😤', '😔', '😴', '🤔', '🎉', '💪'];

/* ─── Page ─── */

export function EveningWinddownPage() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [prompt, setPrompt] = useState<EveningPrompt>(() =>
    EVENING_PROMPTS[Math.floor(Math.random() * EVENING_PROMPTS.length)]
  );
  const [greeting] = useState(() =>
    EVENING_GREETINGS[Math.floor(Math.random() * EVENING_GREETINGS.length)]
  );

  // Reflection state
  const [dailyNote, setDailyNote] = useState<DailyNote>({ content: '', reflectionData: null });
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [wentWell, setWentWell] = useState('');
  const [toImprove, setToImprove] = useState('');
  const [tomorrowPriorities, setTomorrowPriorities] = useState('');

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load today's completed tasks and time blocks
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [blocksData, tasksData, tomorrowData, notesData] = await Promise.all([
        apiFetch<Block[]>(`/time-blocks?from=${todayStart}&to=${todayEnd}`),
        apiFetch<Task[]>('/tasks'),
        apiFetch<Task[]>(`/tasks?dueDate=${tomorrow}`),
        apiFetch<DailyNote>(`/daily-notes?date=${today}`),
      ]);

      if (blocksData) {
        setBlocks(blocksData.filter((b: Block) => b.status === 'completed' || b.actualMinutes));
      }

      if (tasksData) {
        setTasks(tasksData.filter((t: Task) => t.status === 'done'));
      }

      if (tomorrowData) {
        setTomorrowTasks(tomorrowData.filter((t: Task) =>
          ['todo', 'doing'].includes(t.status) && t.dueDate === tomorrow
        ).slice(0, 3));
      }

      if (notesData) {
        setDailyNote(notesData);
        if (notesData.reflectionData) {
          setSelectedMood(notesData.reflectionData.mood || '');
          setWentWell(notesData.reflectionData.wentWell || '');
          setToImprove(data.reflectionData.toImprove || '');
          setTomorrowPriorities(data.reflectionData.tomorrowPriorities || '');
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load evening data');
    } finally {
      setLoading(false);
    }
  }, [today, tomorrow]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveReflection = async () => {
    try {
      const reflectionData = {
        mood: selectedMood,
        wentWell,
        toImprove,
        tomorrowPriorities,
      };

      await apiFetch('/daily-notes', {
        method: 'PUT',
        body: JSON.stringify({
          date: today,
          content: dailyNote.content || '',
          reflectionData,
        }),
      });

      toast.success('Evening reflection saved');
      setCompleted(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save reflection');
    }
  };

  const totalMinutes = blocks.reduce((sum, b) => sum + (b.actualMinutes || 0), 0);
  const completedCount = tasks.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Moon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {greeting}
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Time to reflect on your day and prepare for tomorrow
          </p>
        </div>

        {/* Day Summary */}
        <Card className="border-none shadow-lg bg-white/70 dark:bg-gray-800/70 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-600" />
              <h2 className="text-xl font-semibold">Today's Highlights</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                    {completedCount}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tasks completed</p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {Math.round(totalMinutes / 60)}h
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Time focused</p>
              </div>
            </div>

            {/* Top 3 completed tasks */}
            {tasks.slice(0, 3).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Top achievements:</p>
                {tasks.slice(0, 3).map(task => (
                  <div key={task.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="line-through decoration-gray-400">{task.title}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evening Reflection */}
        <Card className="border-none shadow-lg bg-white/70 dark:bg-gray-800/70 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold">Evening Reflection</h2>
            </div>

            {/* Mood selector */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                How are you feeling tonight?
              </label>
              <div className="flex gap-2 flex-wrap">
                {MOOD_OPTIONS.map(mood => (
                  <button
                    key={mood}
                    onClick={() => setSelectedMood(mood)}
                    className={cn(
                      'w-12 h-12 text-2xl rounded-lg transition-all hover:scale-110',
                      selectedMood === mood
                        ? 'bg-purple-100 dark:bg-purple-900/50 ring-2 ring-purple-500'
                        : 'bg-gray-100 dark:bg-gray-800'
                    )}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 p-4 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {prompt.prompt}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-indigo-600 dark:text-indigo-400"
                    onClick={() => {
                      const newPrompt = EVENING_PROMPTS[Math.floor(Math.random() * EVENING_PROMPTS.length)];
                      setPrompt(newPrompt);
                    }}
                  >
                    <Lightbulb className="w-4 h-4 mr-1" />
                    New prompt
                  </Button>
                </div>
              </div>
            </div>

            {/* Reflection fields */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  What went well today?
                </label>
                <Textarea
                  placeholder="Celebrate your wins..."
                  value={wentWell}
                  onChange={e => setWentWell(e.target.value)}
                  className="min-h-20"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  What could be improved?
                </label>
                <Textarea
                  placeholder="No judgment, just awareness..."
                  value={toImprove}
                  onChange={e => setToImprove(e.target.value)}
                  className="min-h-20"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Top priorities for tomorrow?
                </label>
                <Textarea
                  placeholder="What will make tomorrow great?"
                  value={tomorrowPriorities}
                  onChange={e => setTomorrowPriorities(e.target.value)}
                  className="min-h-20"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tomorrow Preview */}
        <Card className="border-none shadow-lg bg-white/70 dark:bg-gray-800/70 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold">Tomorrow's Focus</h2>
            </div>

            {tomorrowTasks.length > 0 ? (
              <div className="space-y-2">
                {tomorrowTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Target className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">{task.title}</span>
                    </div>
                    <Badge className={PRIORITY_LABEL[task.priority].cls}>
                      {PRIORITY_LABEL[task.priority].label}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No high-priority tasks set for tomorrow</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate('/tasks')}
                >
                  Plan tomorrow
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complete Button */}
        {!completed ? (
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            onClick={saveReflection}
          >
            <Moon className="w-5 h-5 mr-2" />
            Complete Evening Wind-down
          </Button>
        ) : (
          <Card className="border-none shadow-lg bg-green-50/70 dark:bg-green-900/30 backdrop-blur">
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                Evening Complete!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                Rest well. You've earned it.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="bg-green-100 dark:bg-green-900/50"
              >
                Go to dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
