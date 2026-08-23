import { useState } from 'react';
import { Sparkles, Clock, Calendar, CheckCircle, Timer } from 'lucide-react';
import { useQuickCaptureContext } from '@/components/quick-capture-provider';
import { TemplateSelector } from '@/components/template-selector';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-client';
import { parseQuickAdd } from '@/lib/parse-quick-add';
import { toast } from 'sonner';

type CaptureType = 'task' | 'habit';

interface Template {
  id: string;
  name: string;
  description: string | null;
  defaultCategoryId: string | null;
  defaultTitle: string;
  defaultDescription: string | null;
  defaultEstimatedMinutes: number;
  defaultPriority: number;
  defaultStatus: string;
  defaultLabels: string[];
  defaultSubtasks: Array<{ id: string; title: string; done: boolean }>;
  defaultRecurringRule: {
    freq: 'daily' | 'weekly' | 'monthly';
    byDay?: string[];
    interval?: number;
    until?: string;
    defaultTime?: string;
    defaultDurationMinutes?: number;
  } | null;
}

export function QuickCaptureDialog() {
  const { isOpen, close } = useQuickCaptureContext();
  const [input, setInput] = useState('');
  const [type, setType] = useState<CaptureType>('task');
  const [submitting, setSubmitting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const parsed = parseQuickAdd(selectedTemplate?.defaultTitle ? `${selectedTemplate.defaultTitle} ${input}`.trim() : input);

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
            description: selectedTemplate?.defaultDescription || null,
            status: selectedTemplate?.defaultStatus || 'todo',
            priority: parsed.priority || selectedTemplate?.defaultPriority || 3,
            estimatedMinutes: parsed.durationMinutes || selectedTemplate?.defaultEstimatedMinutes || 30,
            dueDate: parsed.dueDate || null,
            categoryId: selectedTemplate?.defaultCategoryId || null,
            labels: selectedTemplate?.defaultLabels || [],
            subtasks: selectedTemplate?.defaultSubtasks || [],
            recurringRule: selectedTemplate?.defaultRecurringRule || null,
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
      setSelectedTemplate(null);
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

          {type === 'task' && (
            <div className="flex items-center gap-2">
              <TemplateSelector
                onSelect={(template) => {
                  setSelectedTemplate(template);
                  setInput('');
                }}
              />
              {selectedTemplate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTemplate(null)}
                  className="h-7 px-2"
                >
                  <span className="text-xs">{selectedTemplate.name}</span>
                  <span className="ml-1 text-muted-foreground">×</span>
                </Button>
              )}
            </div>
          )}

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
                ? 'e.g., "Meeting with John tomorrow 2pm-4pm" or "Review docs in 3 days 30min"'
                : 'e.g., "Morning meditation"'}
              autoFocus
              className="text-base"
            />

            {(parsed.dueDate || parsed.dueTime || parsed.endTime || parsed.durationMinutes || parsed.priority) && (
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
                    {parsed.endTime && ` - ${parsed.endTime}`}
                  </Badge>
                )}
                {parsed.durationMinutes && (
                  <Badge variant="secondary" className="gap-1">
                    <Timer className="size-3" />
                    {parsed.durationMinutes} min
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
