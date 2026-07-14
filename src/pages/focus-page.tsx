import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, SkipForward, Coffee, Maximize2, Minimize2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

interface FocusTask {
  id: string;
  title: string;
  description: string | null;
  estimatedMinutes: number;
  priority: number;
}

export function FocusPage() {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [task, setTask] = useState<FocusTask | null>(null);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60); // 25 minutes in seconds
  const [isBreak, setIsBreak] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);

  useEffect(() => {
    // Load current task from localStorage (set from planner/dashboard)
    const savedTask = localStorage.getItem('focusTask');
    if (savedTask) {
      setTask(JSON.parse(savedTask));
    }

    // Handle keyboard shortcuts
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitFullscreen();
      }
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    if (!isPaused && pomodoroTime > 0) {
      const timer = setInterval(() => {
        setPomodoroTime(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (pomodoroTime === 0 && !isBreak) {
      // Pomodoro complete, log the session and start break
      const sessionMinutes = 25;
      setCompletedSessions(prev => prev + 1);
      setTotalMinutes(prev => prev + sessionMinutes);
      logFocusSession(sessionMinutes);
      setIsBreak(true);
      setPomodoroTime(5 * 60);
      if (Notification.permission === 'granted') {
        new Notification('🍅 Pomodoro Complete!', {
          body: 'Time for a break!',
          icon: '/favicon.ico'
        });
      }
      toast.success(`Focus session complete! ${completedSessions + 1} pomodoro${completedSessions > 0 ? 's' : ''} done today.`);
    } else if (pomodoroTime === 0 && isBreak) {
      // Break complete, start new pomodoro
      setIsBreak(false);
      setPomodoroTime(25 * 60);
      if (Notification.permission === 'granted') {
        new Notification('⏰ Break Over!', {
          body: 'Ready for another focus session?',
          icon: '/favicon.ico'
        });
      }
    }
  }, [pomodoroTime, isPaused, isBreak, completedSessions]);

  const togglePause = () => setIsPaused(!isPaused);

  const skipBreak = () => {
    setIsBreak(false);
    setPomodoroTime(25 * 60);
  };

  const logFocusSession = async (minutes: number) => {
    if (!task) return;

    const now = new Date();
    const startAt = new Date(now.getTime() - minutes * 60_000);
    const endAt = now;

    try {
      await apiFetch('/api/time-blocks', {
        method: 'POST',
        body: JSON.stringify({
          title: `Focus: ${task.title}`,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          actualMinutes: minutes,
          status: 'completed',
          note: `Focus session • Priority ${task.priority} • ${completedSessions + 1} pomodoro${completedSessions > 0 ? 's' : ''} completed`,
        }),
      });
    } catch (err) {
      console.error('Failed to log focus session:', err);
      toast.error('Failed to log focus session to timeline');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen().then(() => {
      setIsFullscreen(true);
    }).catch(() => {
      // Fallback: just use immersive UI without actual fullscreen
      setIsFullscreen(true);
    });
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    } else {
      setIsFullscreen(false);
    }
  };

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-background to-fuchsia-50 dark:from-violet-950/20 dark:via-background dark:to-fuchsia-950/20">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">No task selected for focus mode</p>
          <Button asChild variant="outline">
            <button onClick={() => navigate('/planner')}>Go to Planner</button>
          </Button>
        </div>
      </div>
    );
  }

  const priorityColors = {
    1: 'text-red-500',
    2: 'text-orange-500',
    3: 'text-yellow-500',
    4: 'text-blue-500',
    5: 'text-slate-500',
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-background to-fuchsia-50 dark:from-violet-950/20 dark:via-background dark:to-fuchsia-950/20 transition-all duration-300 ${isFullscreen ? 'p-8' : 'p-4'}`}>
      {/* Header controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/planner')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 mr-2" />
          Exit
        </Button>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={isFullscreen ? exitFullscreen : enterFullscreen}
            className="text-muted-foreground hover:text-foreground"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className={`max-w-3xl w-full text-center space-y-8 ${isFullscreen ? 'scale-125' : 'scale-100'} transition-transform duration-300`}>
        {/* Priority badge */}
        <div className="flex justify-center">
          <span className={`text-sm font-medium ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
            Priority {task.priority}
          </span>
        </div>

        {/* Task title */}
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          {task.title}
        </h1>

        {/* Task description */}
        {task.description && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Timer */}
        <div className="space-y-4">
          <div className={`font-mono text-8xl sm:text-9xl font-bold tracking-tighter bg-gradient-to-br from-foreground via-primary to-fuchsia-600 bg-clip-text text-transparent ${isPaused ? 'opacity-50' : ''}`}>
            {formatTime(pomodoroTime)}
          </div>

          <p className="text-sm text-muted-foreground">
            {isBreak ? '🍵 Break time' : isPaused ? '⏸️ Paused (Space to resume)' : '⏱️ Focus session (Space to pause)'}
          </p>

          {/* Session counter */}
          {completedSessions > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Check className="size-4 text-green-500" />
              <span className="text-muted-foreground">
                {completedSessions} pomodoro{completedSessions > 1 ? 's' : ''} completed • {totalMinutes}min focused
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3 pt-4">
          {!isBreak ? (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={togglePause}
                className="min-w-[140px]"
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </Button>
              <Button
                variant="default"
                size="lg"
                onClick={() => {
                  const sessionMinutes = 25;
                  setCompletedSessions(prev => prev + 1);
                  setTotalMinutes(prev => prev + sessionMinutes);
                  logFocusSession(sessionMinutes);
                  setIsBreak(true);
                  setPomodoroTime(5 * 60);
                }}
                className="min-w-[140px]"
              >
                <SkipForward className="size-4 mr-2" />
                Skip to Break
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={togglePause}
                className="min-w-[140px]"
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </Button>
              <Button
                variant="default"
                size="lg"
                onClick={skipBreak}
                className="min-w-[140px]"
              >
                <Coffee className="size-4 mr-2" />
                End Break
              </Button>
            </>
          )}
        </div>

        {/* Finish button */}
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem('focusTask');
              if (completedSessions > 0) {
                toast.success(`Great work! ${completedSessions} pomodoro${completedSessions > 1 ? 's' : ''} completed (${totalMinutes}min). Session logged to timeline.`);
              }
              navigate('/planner');
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <Check className="size-4 mr-2" />
            Finish Focus Session
          </Button>
        </div>

        {/* Estimated time */}
        {task.estimatedMinutes > 0 && (
          <p className="text-sm text-muted-foreground">
            Estimated: {task.estimatedMinutes} minutes
          </p>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      {!isFullscreen && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Space</kbd> to pause · <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> to exit
          </p>
        </div>
      )}
    </div>
  );
}

export default FocusPage;
