import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Check, ChevronUp, Circle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Task } from './use-planner-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

/** Status cycle order for quick-action button */
export const STATUS_CYCLE: Task['status'][] = ['backlog', 'todo', 'doing', 'done'];

/** Human label + icon color per status */
export const STATUS_META: Record<Task['status'], { label: string; fg: string }> = {
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

export function DraggableTaskCard({ task, onUpdate, onDelete }: {
  task: Task;
  onUpdate: (id: string, patch: Partial<Pick<Task, 'status' | 'priority' | 'title' | 'description' | 'estimatedMinutes'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: 'task', task },
  });
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="size-6" onClick={() => setEditOpen(true)} disabled={busy}
            title="Edit task details">
            <Pencil className="size-3" />
          </Button>
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
      {task.description && (
        <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <TaskEditDialog task={task} open={editOpen} onOpenChange={setEditOpen}
        onSave={async (patch) => {
          try { await onUpdate(task.id, patch); toast.success('Task updated'); }
          catch (e) { toast.error((e as Error).message); }
        }} />
    </div>
  );
}

export function NewTaskDialog({ onCreate, open: controlledOpen, onOpenChange }: {
  onCreate: (title: string, minutes: number) => void;
  /** Optional controlled mode for external triggering (keyboard shortcut). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
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

export function TaskEditDialog({ task, open, onOpenChange, onSave }: {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: Partial<Pick<Task, 'title' | 'description' | 'estimatedMinutes' | 'priority'>>) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [minutes, setMinutes] = useState(task.estimatedMinutes);
  const [priority, setPriority] = useState(task.priority);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setMinutes(task.estimatedMinutes);
    setPriority(task.priority);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        estimatedMinutes: minutes,
        priority,
      });
      onOpenChange(false);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onOpenChange(false); } }}>
      <DialogContent onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Update title, description, time estimate, and priority.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="te-title">Title</Label>
              <Input id="te-title" autoFocus required
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="te-desc">Description</Label>
              <Textarea id="te-desc" rows={3} placeholder="Optional notes…"
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="te-min">Estimated minutes</Label>
                <Input id="te-min" type="number" min={15} step={15}
                  value={minutes} onChange={e => setMinutes(Number(e.target.value) || 60)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="te-pri">Priority (1 = highest)</Label>
                <Input id="te-pri" type="number" min={1} max={4}
                  value={priority} onChange={e => setPriority(Math.min(4, Math.max(1, Number(e.target.value) || 3)))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? '…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
