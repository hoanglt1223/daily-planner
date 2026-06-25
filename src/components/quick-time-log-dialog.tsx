import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Kbd } from '@/components/ui/kbd';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type Task = {
  id: string; title: string; status: string;
  priority: number; estimatedMinutes: number; categoryId: string | null;
};

type Category = { id: string; name: string; color: string };

const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: 'Urgent', cls: 'bg-red-100 text-red-700' },
  2: { label: 'High', cls: 'bg-orange-100 text-orange-700' },
  3: { label: 'Normal', cls: 'bg-muted text-muted-foreground' },
  4: { label: 'Low', cls: 'bg-sky-100 text-sky-700' },
};

const QUICK_MINUTES = [15, 30, 45, 60, 90, 120];

/**
 * Quick time log — retroactively log time spent on a task.
 * Accessible via `l` shortcut or FAB button.
 */
export function QuickTimeLogDialog() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Listen for global shortcut event
  useEffect(() => {
    function onOpen() { setOpen(true); }
    document.addEventListener('shortcut:quick-time-log', onOpen);
    return () => document.removeEventListener('shortcut:quick-time-log', onOpen);
  }, []);

  // Fetch tasks and categories when dialog opens
  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch<Task[]>('/api/tasks'),
      apiFetch<Category[]>('/api/categories'),
    ]).then(([t, c]) => {
      setTasks(t.filter(t => t.status !== 'done' && t.status !== 'archived'));
      setCategories(c);
    }).catch(() => {});
  }, [open]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const reset = useCallback(() => {
    setSelectedTaskId(null);
    setMinutes(30);
    setNote('');
  }, []);

  const selectedTask = useMemo(
    () => tasks.find(t => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTaskId || minutes < 1) return;
    setSubmitting(true);
    try {
      const now = new Date();
      const startAt = new Date(now.getTime() - minutes * 60_000);
      await apiFetch('/api/time-blocks', {
        method: 'POST',
        body: JSON.stringify({
          taskId: selectedTaskId,
          title: selectedTask?.title ?? 'Logged time',
          startAt: startAt.toISOString(),
          endAt: now.toISOString(),
          note: note.trim() || null,
          status: 'completed',
        }),
      });
      toast.success(`Logged ${minutes}m on "${selectedTask?.title}"`);
      reset();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Sort: doing first, then by priority
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.status === 'doing' && b.status !== 'doing') return -1;
      if (b.status === 'doing' && a.status !== 'doing') return 1;
      return a.priority - b.priority || a.title.localeCompare(b.title);
    });
  }, [tasks]);

  return (
    <>
      {/* Floating Action Button */}
      <Button
        size="icon"
        variant="secondary"
        className="fixed bottom-6 left-[4.5rem] z-40 size-10 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        title="Log time (l)"
        aria-label="Log time"
      >
        <Clock className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Log time</DialogTitle>
              <DialogDescription>
                Record time you already spent on a task.
                Use <Kbd>l</Kbd> from anywhere.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              {/* Task selector */}
              <div className="space-y-1.5">
                <Label id="qtl-task-label">Task</Label>
                <div role="radiogroup" aria-labelledby="qtl-task-label" className="max-h-48 space-y-1.5 overflow-y-auto rounded-md ring-hairline p-2">
                  {sortedTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2 text-center">No active tasks.</p>
                  )}
                  {sortedTasks.map(t => {
                    const cat = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
                    const prio = PRIORITY_LABEL[t.priority] ?? PRIORITY_LABEL[3];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={selectedTaskId === t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2 text-left transition-colors',
                          selectedTaskId === t.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border hover:border-foreground/20',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {cat && (
                            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                          )}
                          <span className="text-sm font-medium truncate flex-1">{t.title}</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium', prio.cls)}>
                            {prio.label}
                          </span>
                          {t.status === 'doing' && (
                            <span className="rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-medium">
                              In progress
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minutes */}
              <div className="space-y-1.5">
                <Label id="qtl-time-label">Time spent</Label>
                <div role="radiogroup" aria-labelledby="qtl-time-label" className="flex flex-wrap gap-1.5">
                  {QUICK_MINUTES.map(m => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={minutes === m}
                      onClick={() => setMinutes(m)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                        minutes === m
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                    >
                      {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? `${m % 60}m` : ''}` : `${m}m`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="qtl-min" className="text-xs text-muted-foreground">Custom:</Label>
                  <Input
                    id="qtl-min"
                    type="number"
                    min={1}
                    max={480}
                    value={minutes}
                    onChange={e => setMinutes(Math.max(1, Number(e.target.value) || 1))}
                    className="h-8 w-20 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">minutes</span>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1">
                <Label htmlFor="qtl-note">Note (optional)</Label>
                <Textarea
                  id="qtl-note"
                  rows={2}
                  placeholder="What did you work on?"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { reset(); setOpen(false); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !selectedTaskId}>
                {submitting ? '…' : `Log ${minutes}m`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
