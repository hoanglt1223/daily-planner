import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, ArrowUpDown, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Edit3, PlayCircle, Plus, Search, Tag, Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/* ─── Types ─── */

type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done' | 'archived';

interface Task {
  id: string; title: string; description: string | null;
  status: TaskStatus; priority: number; estimatedMinutes: number;
  dueDate: string | null; categoryId: string | null; isPinned: boolean;
  createdAt: string; updatedAt: string;
}

interface Category { id: string; name: string; color: string }

/* ─── Constants ─── */

const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  3: { label: 'Normal', cls: 'bg-muted text-muted-foreground border-border' },
  4: { label: 'Low', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  5: { label: 'Someday', cls: 'bg-muted text-muted-foreground border-border' },
};

const STATUS_META: Record<TaskStatus, { label: string; icon: typeof CheckCircle2; color: string }> = {
  backlog:   { label: 'Backlog',   icon: Archive,      color: 'text-slate-500' },
  todo:      { label: 'To Do',     icon: Clock,        color: 'text-blue-500' },
  doing:     { label: 'In Progress', icon: PlayCircle, color: 'text-amber-500' },
  done:      { label: 'Done',      icon: CheckCircle2, color: 'text-emerald-500' },
  archived:  { label: 'Archived',  icon: Archive,      color: 'text-slate-400' },
};

const STATUS_OPTIONS: TaskStatus[] = ['backlog', 'todo', 'doing', 'done', 'archived'];

const SORT_OPTIONS = [
  { value: 'smart', label: 'Smart (priority + due)' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'estimated', label: 'Estimated time' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'created', label: 'Newest first' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

/* ─── Page ─── */

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'done' | 'archived' | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('smart');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c] = await Promise.all([
        apiFetch<Task[]>('/api/tasks'),
        apiFetch<Category[]>('/api/categories'),
      ]);
      setTasks(t);
      setCategories(c);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tasks
      .filter(t => {
        if (statusFilter === 'active') return t.status !== 'done' && t.status !== 'archived';
        if (statusFilter === 'done') return t.status === 'done';
        if (statusFilter === 'archived') return t.status === 'archived';
        return true; // 'all'
      })
      .filter(t => categoryFilter === null || t.categoryId === categoryFilter)
      .filter(t => !q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (sortBy === 'priority') return a.priority - b.priority || a.title.localeCompare(b.title);
        if (sortBy === 'dueDate') {
          const aD = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bD = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return aD - bD || a.priority - b.priority;
        }
        if (sortBy === 'estimated') return a.estimatedMinutes - b.estimatedMinutes || a.priority - b.priority;
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        // smart: due date → priority → title
        const aD = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bD = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (aD !== bD) return aD - bD;
        return a.priority - b.priority || a.title.localeCompare(b.title);
      });
  }, [tasks, search, statusFilter, categoryFilter, sortBy]);

  async function updateTask(id: string, patch: Partial<Task>) {
    setBusyId(id);
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
      toast.success('Task updated');
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function deleteTask(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Task deleted');
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  const counts = useMemo(() => {
    const c = { backlog: 0, todo: 0, doing: 0, done: 0, archived: 0 };
    tasks.forEach(t => c[t.status]++);
    return c;
  }, [tasks]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {counts.todo + counts.doing} active · {counts.done} done · {counts.archived} archived
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="size-4 mr-1.5" /> New task
        </Button>
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2">
        {(['active', 'done', 'archived', 'all'] as const).map(s => {
          const count = s === 'active' ? counts.todo + counts.doing + counts.backlog
            : s === 'all' ? tasks.length
            : counts[s] ?? 0;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/30',
              )}
            >
              {s === 'active' ? 'Active' : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <Select value={categoryFilter ?? 'all'} onValueChange={v => setCategoryFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="h-9 w-auto min-w-[140px]">
              <Tag className="size-3.5 mr-1.5" />
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort */}
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger className="h-9 w-auto min-w-[160px]">
            <ArrowUpDown className="size-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <CheckCircle2 className="mx-auto size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search || statusFilter !== 'all' || categoryFilter ? 'No matching tasks' : 'No tasks yet'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {search ? 'Try a different search term' : 'Click "New task" to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              category={task.categoryId ? catMap.get(task.categoryId) : undefined}
              busy={busyId === task.id}
              onStatusChange={(status) => updateTask(task.id, { status })}
              onEdit={() => setEditTask(task)}
              onDelete={() => deleteTask(task.id)}
              onPin={() => updateTask(task.id, { isPinned: !task.isPinned })}
            />
          ))}
        </div>
      )}

      {/* New task dialog */}
      <NewTaskDialog open={newOpen} onOpenChange={setNewOpen} categories={categories} onCreated={load} />

      {/* Edit task dialog */}
      {editTask && (
        <EditTaskDialog
          task={editTask}
          categories={categories}
          onClose={() => setEditTask(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

/* ─── Task Row ─── */

function TaskRow({ task, category, busy, onStatusChange, onEdit, onDelete, onPin }: {
  task: Task; category?: Category; busy: boolean;
  onStatusChange: (s: TaskStatus) => void; onEdit: () => void; onDelete: () => void; onPin: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const prio = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL[3];
  const meta = STATUS_META[task.status];
  const StatusIcon = meta.icon;

  const estH = Math.floor(task.estimatedMinutes / 60);
  const estM = task.estimatedMinutes % 60;
  const estStr = estH > 0 ? (estM ? `${estH}h${estM}m` : `${estH}h`) : `${estM}m`;

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && task.status !== 'archived';

  return (
    <div className={cn(
      'group rounded-lg border bg-card transition-all hover:shadow-sm',
      task.isPinned && 'ring-1 ring-primary/20',
      isOverdue && 'border-red-200 bg-red-50/30',
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Expand toggle */}
        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground shrink-0">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        {/* Status icon */}
        <button
          onClick={() => {
            const next: Record<TaskStatus, TaskStatus> = {
              backlog: 'todo', todo: 'doing', doing: 'done', done: 'archived', archived: 'backlog',
            };
            onStatusChange(next[task.status]);
          }}
          className="shrink-0"
          title={`Status: ${meta.label} (click to change)`}
        >
          <StatusIcon className={cn('size-5', meta.color, busy && 'animate-pulse')} />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-medium truncate',
              (task.status === 'done' || task.status === 'archived') && 'line-through text-muted-foreground',
            )}>
              {task.title}
            </span>
            {task.isPinned && <span className="text-[10px] text-primary">📌</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', prio.cls)}>
              {prio.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="size-3" /> {estStr}
            </span>
            {task.dueDate && (
              <span className={cn(
                'text-[10px] flex items-center gap-0.5',
                isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground',
              )}>
                {isOverdue && <AlertTriangle className="size-3" />}
                Due {fmtShortDate(new Date(task.dueDate))}
              </span>
            )}
            {category && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                {category.name}
              </span>
            )}
          </div>
        </div>

        {/* Quick actions (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {task.status !== 'doing' && task.status !== 'done' && task.status !== 'archived' && (
            <Button size="icon" variant="ghost" className="size-7" title="Start working"
              disabled={busy} onClick={() => onStatusChange('doing')}>
              <PlayCircle className="size-3.5 text-blue-600" />
            </Button>
          )}
          {task.status !== 'done' && task.status !== 'archived' && (
            <Button size="icon" variant="ghost" className="size-7" title="Mark done"
              disabled={busy} onClick={() => onStatusChange('done')}>
              <CheckCircle2 className="size-3.5 text-emerald-600" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-7" title="Edit"
            disabled={busy} onClick={onEdit}>
            <Edit3 className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" title={task.isPinned ? 'Unpin' : 'Pin'}
            disabled={busy} onClick={onPin}>
            <span className="text-xs">{task.isPinned ? '📌' : '📍'}</span>
          </Button>
          <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" title="Delete"
            disabled={busy} onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 py-3 pl-14 space-y-2 text-sm">
          {task.description && (
            <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Status: <strong className="text-foreground">{meta.label}</strong></span>
            <span>Created: {fmtShortDate(new Date(task.createdAt))}</span>
            {task.dueDate && <span>Due: {fmtShortDate(new Date(task.dueDate))}</span>}
          </div>
          {/* Status quick-change */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">Move to:</span>
            {STATUS_OPTIONS.filter(s => s !== task.status).map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                disabled={busy}
                className={cn(
                  'rounded border px-2 py-0.5 text-[10px] font-medium transition-colors',
                  'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── New Task Dialog ─── */

function NewTaskDialog({ open, onOpenChange, categories, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; categories: Category[]; onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [priority, setPriority] = useState(3);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle(''); setMinutes(60); setPriority(3); setCategoryId(null); setDueDate('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(), estimatedMinutes: minutes, priority,
          categoryId, dueDate: dueDate || null, status: 'todo',
        }),
      });
      toast.success('Task created!');
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Add a task to your backlog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="nt-title">Title</Label>
              <Input id="nt-title" autoFocus required placeholder="What do you need to do?"
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nt-min">Est. minutes</Label>
                <Input id="nt-min" type="number" min={15} step={15}
                  value={minutes} onChange={e => setMinutes(Number(e.target.value) || 60)} />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(p => (
                    <button key={p} type="button"
                      className={cn(
                        'flex-1 rounded border py-1 text-xs font-medium transition-colors',
                        priority === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                      onClick={() => setPriority(p)}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
            {categories.length > 0 && (
              <div className="space-y-1">
                <Label>Category</Label>
                <div className="flex flex-wrap gap-1">
                  <button type="button"
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      categoryId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                    )}
                    onClick={() => setCategoryId(null)}>None</button>
                  {categories.map(c => (
                    <button key={c.id} type="button"
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1',
                        categoryId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
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
              <Label htmlFor="nt-due">Due date (optional)</Label>
              <Input id="nt-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button type="submit" disabled={submitting || !title.trim()}>{submitting ? '…' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Task Dialog ─── */

function EditTaskDialog({ task, categories, onClose, onSaved }: {
  task: Task; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [minutes, setMinutes] = useState(task.estimatedMinutes);
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [categoryId, setCategoryId] = useState<string | null>(task.categoryId);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim(), description: description || null,
          estimatedMinutes: minutes, priority, status, categoryId,
          dueDate: dueDate || null,
        }),
      });
      toast.success('Task updated!');
      onClose();
      onSaved();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="et-title">Title</Label>
              <Input id="et-title" autoFocus required value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="et-desc">Description</Label>
              <Input id="et-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="et-min">Est. minutes</Label>
                <Input id="et-min" type="number" min={15} step={15} value={minutes} onChange={e => setMinutes(Number(e.target.value) || 60)} />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(p => (
                    <button key={p} type="button"
                      className={cn(
                        'flex-1 rounded border py-1 text-xs font-medium transition-colors',
                        priority === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                      onClick={() => setPriority(p)}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map(s => {
                  const m = STATUS_META[s];
                  return (
                    <button key={s} type="button"
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors flex items-center gap-1',
                        status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                      onClick={() => setStatus(s)}>
                      <m.icon className="size-3" /> {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {categories.length > 0 && (
              <div className="space-y-1">
                <Label>Category</Label>
                <div className="flex flex-wrap gap-1">
                  <button type="button"
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      categoryId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                    )}
                    onClick={() => setCategoryId(null)}>None</button>
                  {categories.map(c => (
                    <button key={c.id} type="button"
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1',
                        categoryId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
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
              <Label htmlFor="et-due">Due date</Label>
              <Input id="et-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting || !title.trim()}>{submitting ? '…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Helpers ─── */

function fmtShortDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
