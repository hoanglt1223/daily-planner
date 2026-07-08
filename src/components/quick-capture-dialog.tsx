import { useState } from 'react';
import { Sparkles, Clock, Calendar, CheckCircle } from 'lucide-react';
import { useQuickCaptureContext } from '@/components/quick-capture-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { parseQuickAdd } from '@/lib/parse-quick-add';
import { toast } from 'sonner';

type CaptureType = 'task' | 'habit';

export function QuickCaptureDialog() {
  const { isOpen, close } = useQuickCaptureContext();
  const [input, setInput] = useState('');
  const [type, setType] = useState<CaptureType>('task');
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseQuickAdd(input);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || submitting) return;

    setSubmitting(true);
    try {
      if (type === 'task') {
        await apiFetch('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title: parsed.title || input,
            description: null,
            status: 'todo',
            priority: parsed.priority || 3,
            estimatedMinutes: 30,
            dueDate: parsed.dueDate || null,
            categoryId: null,
          }),
        });
        toast.success('Task captured');
      } else {
        await apiFetch('/api/habits', {
          method: 'POST',
          body: JSON.stringify({
            name: parsed.title || input,
            description: null,
            frequency: 'daily',
            targetDays: [],
            color: '#10b981',
            icon: '✓',
            targetPerPeriod: 1,
          }),
        });
        toast.success('Habit captured');
      }
      setInput('');
      close();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md" onKeyDown={handleKeyDown}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Quick Capture</h2>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === 'task' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('task')}
              className="flex-1"
            >
              <CheckCircle className="size-3.5 mr-1.5" />
              Task
            </Button>
            <Button
              type="button"
              variant={type === 'habit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType('habit')}
              className="flex-1"
            >
              <Clock className="size-3.5 mr-1.5" />
              Habit
            </Button>
          </div>

          <div className="space-y-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={type === 'task'
                ? 'e.g., "Call John tomorrow at 2pm !p2"'
                : 'e.g., "Morning meditation"'}
              autoFocus
              className="text-base"
            />

            {(parsed.dueDate || parsed.dueTime || parsed.priority) && (
              <div className="flex flex-wrap gap-1.5">
                {parsed.dueDate && (
                  <Badge variant="secondary" className="gap-1">
                    <Calendar className="size-3" />
                    {new Date(parsed.dueDate).toLocaleDateString()}
                  </Badge>
                )}
                {parsed.dueTime && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="size-3" />
                    {parsed.dueTime}
                  </Badge>
                )}
                {parsed.priority && (
                  <Badge variant="secondary">Priority {parsed.priority}</Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Press ⌘K to toggle · Esc to close</span>
            <span>Enter to submit</span>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
