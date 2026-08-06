import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-slate-600' },
  { value: 'medium', label: 'Medium', color: 'text-amber-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600' },
] as const;

type Priority = typeof PRIORITIES[number]['value'];

export function QuickTaskCreate() {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          status: 'backlog',
          priority,
          estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) * 60 : null,
        }),
      });
      toast.success('Task created successfully');
      setTitle('');
      setPriority('medium');
      setEstimatedMinutes('');
      setIsExpanded(false);

      // Trigger a global refresh event
      window.dispatchEvent(new CustomEvent('tasks-changed'));
    } catch (error) {
      toast.error('Failed to create task');
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isExpanded) {
    return (
      <Button
        onClick={() => setIsExpanded(true)}
        className="w-full gap-2"
        size="lg"
      >
        <Plus className="size-4" />
        Quick Add Task
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="task-title" className="text-sm font-medium">
              Task Title *
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="mt-1.5"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-priority" className="text-sm font-medium">
                Priority
              </Label>
              <Select
                value={priority}
                onValueChange={(value: Priority) => setPriority(value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="task-priority" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={p.color}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="task-estimate" className="text-sm font-medium">
                Est. Minutes
              </Label>
              <Input
                id="task-estimate"
                type="number"
                min="0"
                step="5"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="30"
                className="mt-1.5"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="flex-1 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Create Task
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsExpanded(false);
                setTitle('');
                setPriority('medium');
                setEstimatedMinutes('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
