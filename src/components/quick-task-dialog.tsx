import { useCallback, useEffect, useState } from 'react';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { fetchSmartEstimate, getConfidenceColor, getConfidenceIcon } from '@/lib/time-estimator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Kbd } from '@/components/ui/kbd';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

type Category = { id: string; name: string; color: string };

/**
 * Global quick task capture — available from any page via `n` shortcut or FAB.
 * Uses the existing POST /api/tasks endpoint. No backend changes needed.
 */
export function QuickTaskDialog() {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [priority, setPriority] = useState(3);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [smartEstimate, setSmartEstimate] = useState<{ estimate: number; confidence: string; message: string } | null>(null);

  // Fetch categories when dialog opens
  useEffect(() => {
    if (!open) return;
    apiFetch<Category[]>('/api/categories').then(setCategories).catch(() => {});
    setSmartEstimate(null);
  }, [open]);

  // Listen for global shortcut event
  useEffect(() => {
    function onOpen() { setOpen(true); }
    document.addEventListener('shortcut:quick-task', onOpen);
    return () => document.removeEventListener('shortcut:quick-task', onOpen);
  }, []);

  const reset = useCallback(() => {
    setTitle('');
    setMinutes(60);
    setPriority(3);
    setCategoryId(null);
    setDueDate('');
    setSmartEstimate(null);
  }, []);

  const loadSmartEstimate = useCallback(async () => {
    setEstimateLoading(true);
    try {
      const estimate = await fetchSmartEstimate(categoryId, priority);
      if (estimate.estimate) {
        setMinutes(estimate.estimate);
        setSmartEstimate({
          estimate: estimate.estimate,
          confidence: estimate.confidence,
          message: estimate.message,
        });
        toast.success(estimate.message);
      } else {
        toast.info('Not enough data yet for smart estimates');
      }
    } catch (err) {
      toast.error('Failed to load smart estimate');
    } finally {
      setEstimateLoading(false);
    }
  }, [categoryId, priority]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          estimatedMinutes: minutes,
          priority,
          categoryId,
          dueDate: dueDate || null,
          status: 'todo',
        }),
      });
      toast.success('Task captured!');
      window.dispatchEvent(new CustomEvent('task-created'));
      reset();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <Button
        size="icon"
        className="fixed bottom-6 left-6 z-40 size-10 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        title="Quick add task (n)"
        aria-label="Quick add task"
      >
        <Plus className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); } setOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Quick capture</DialogTitle>
              <DialogDescription>
                Add a task to your backlog instantly. Use <Kbd>n</Kbd> from anywhere.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="space-y-1">
                <Label htmlFor="qt-title">What do you need to do?</Label>
                <Input id="qt-title" autoFocus required placeholder="Task title…"
                  value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="qt-min">Est. minutes</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={loadSmartEstimate}
                      disabled={estimateLoading}
                      title="Get smart estimate based on your historical data"
                    >
                      {estimateLoading ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="size-3 mr-1" />
                          Smart
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="relative">
                    <Input id="qt-min" type="number" min={15} step={15}
                      value={minutes} onChange={e => setMinutes(Number(e.target.value) || 60)}
                      className={cn(smartEstimate && 'pr-8')} />
                    {smartEstimate && (
                      <span className={cn(
                        'absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium',
                        getConfidenceColor(smartEstimate.confidence as any)
                      )}>
                        {getConfidenceIcon(smartEstimate.confidence as any)}
                      </span>
                    )}
                  </div>
                  {smartEstimate && (
                    <p className="text-[10px] text-muted-foreground">{smartEstimate.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label id="qt-pri-label">Priority</Label>
                  <div role="radiogroup" aria-labelledby="qt-pri-label" className="flex gap-1">
                    {([
                      { value: 1, label: 'Urgent' },
                      { value: 2, label: 'High' },
                      { value: 3, label: 'Normal' },
                      { value: 4, label: 'Low' },
                    ] as const).map(p => (
                      <button key={p.value} type="button"
                        role="radio"
                        aria-checked={priority === p.value}
                        className={cn(
                          'flex-1 rounded border py-1 text-xs font-medium transition-colors',
                          priority === p.value
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:border-foreground/30',
                        )}
                        onClick={() => setPriority(p.value)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {categories.length > 0 && (
                <div className="space-y-1">
                  <Label id="qt-cat-label">Category</Label>
                  <div role="radiogroup" aria-labelledby="qt-cat-label" className="flex flex-wrap gap-1">
                    <button type="button"
                      role="radio"
                      aria-checked={categoryId === null}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                        categoryId === null
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                      onClick={() => setCategoryId(null)}>
                      None
                    </button>
                    {categories.map(c => (
                      <button key={c.id} type="button"
                        role="radio"
                        aria-checked={categoryId === c.id}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1',
                          categoryId === c.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:border-foreground/30',
                        )}
                        onClick={() => setCategoryId(c.id)}>
                        <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="qt-due">Due date (optional)</Label>
                <Input id="qt-due" type="date"
                  value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { reset(); setOpen(false); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !title.trim()}>
                {submitting ? '…' : 'Capture'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
