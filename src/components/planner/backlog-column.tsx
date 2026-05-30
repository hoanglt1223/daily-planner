import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Check, ChevronUp, Circle, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Task } from './use-planner-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

/** Status cycle order for quick-action button */
const STATUS_CYCLE: Task['status'][] = ['backlog', 'todo', 'doing', 'done'];

/** Human label + icon color per status */
const STATUS_META: Record<Task['status'], { label: string; fg: string }> = {
  backlog:  { label: 'Backlog', fg: 'text-muted-foreground' },
  todo:     { label: 'To Do',   fg: 'text-sky-600' },
  doing:    { label: 'Doing',   fg: 'text-amber-600' },
  done:     { label: 'Done',    fg: 'text-emerald-600' },
  archived: { label: 'Archived', fg: 'text-muted-foreground' },
};

/** Priority badge colors */
const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-slate-100 text-slate-600',
  4: 'bg-slate-50 text-slate-400',
};

export function BacklogColumn({ tasks, onNew, onUpdate, onDelete }: {
  tasks: Task[];
  onNew: (title: string, minutes: number) => void;
  onUpdate: (id: string, patch: Partial<Pick<Task, 'status' | 'priority'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const active = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  return (
    <aside className="w-64 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Backlog</h2>
        <NewTaskDialog onCreate={onNew} />
      </div>
      <div className="space-y-2">
        {active.map(t => (
          <DraggableTaskCard key={t.id} task={t} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {active.length === 0 && (
          <p className="text-xs text-muted-foreground">No tasks. Click + New.</p>
        )}
      </div>
    </aside>
  );
}

function DraggableTaskCard({ task, onUpdate, onDelete }: {
  task: Task;
  onUpdate: (id: string, patch: Partial<Pick<Task, 'status' | 'priority'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: 'task', task },
  });
  const [busy, setBusy] = useState(false);
  const meta = STATUS_META[task.status];

  async function cycleStatus() {
    const idx = STATUS_CYCLE.indexOf(task.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setBusy(true);
    try { await onUpdate(task.id, { status: next }); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function bumpPriority() {
    const next = task.priority > 1 ? task.priority - 1 : 3;
    setBusy(true);
    try { await onUpdate(task.id, { priority: next }); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    setBusy(true);
    try { await onDelete(task.id); toast.success('Task removed'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`group relative cursor-grab rounded border bg-card p-2 text-sm shadow-sm transition-colors hover:border-foreground/20 ${isDragging ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="font-medium leading-tight flex-1">{task.title}</p>
        {/* Quick-action buttons — visible on hover or always on touch */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="size-6" onClick={cycleStatus} disabled={busy}
            title={`Status: ${meta.label} → ${STATUS_META[STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]].label}`}>
            {busy ? <Loader2 className="size-3 animate-spin" /> :
              task.status === 'done' ? <Check className="size-3" /> :
              task.status === 'doing' ? <Loader2 className="size-3" /> :
              <Circle className="size-3" />}
          </Button>
          <Button size="icon" variant="ghost" className="size-6" onClick={bumpPriority} disabled={busy}
            title={`Priority: P${task.priority} (click to cycle)`}>
            <ChevronUp className="size-3" />
          </Button>
          <Button size="icon" variant="ghost" className="size-6 text-destructive hover:text-destructive" onClick={handleDelete} disabled={busy}
            title="Delete task">
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className={`inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[3]}`}>
          P{task.priority}
        </span>
        <span className={`text-[10px] ${meta.fg}`}>{meta.label}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{task.estimatedMinutes}m</span>
      </div>
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
