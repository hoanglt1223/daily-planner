import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import type { Task } from './use-planner-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export function BacklogColumn({ tasks, onNew }: {
  tasks: Task[];
  onNew: (title: string, minutes: number) => void;
}) {
  return (
    <aside className="w-64 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Backlog</h2>
        <NewTaskDialog onCreate={onNew} />
      </div>
      <div className="space-y-2">
        {tasks.filter(t => t.status !== 'done' && t.status !== 'archived').map(t => (
          <DraggableTaskCard key={t.id} task={t} />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground">No tasks. Click + New.</p>
        )}
      </div>
    </aside>
  );
}

function DraggableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: 'task', task },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`cursor-grab rounded border bg-card p-2 text-sm shadow-sm ${isDragging ? 'opacity-40' : ''}`}>
      <p className="font-medium leading-tight">{task.title}</p>
      <p className="text-xs text-muted-foreground">{task.estimatedMinutes} min</p>
    </div>
  );
}

function NewTaskDialog({ onCreate }: { onCreate: (title: string, minutes: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(60);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), minutes);
    setTitle(''); setMinutes(60); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Plus className="size-3.5" />New</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Add a task to your backlog. Drag it onto the grid to schedule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="t-title">Title</Label>
              <Input id="t-title" autoFocus required
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-min">Estimated minutes</Label>
              <Input id="t-min" type="number" min={15} step={15}
                value={minutes} onChange={e => setMinutes(Number(e.target.value) || 60)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
