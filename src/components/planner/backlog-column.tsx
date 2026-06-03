import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Plus, Search, Tag, X } from 'lucide-react';
import type { Task, Category } from './use-planner-data';
import { DraggableTaskCard, NewTaskDialog, STATUS_META } from './draggable-task-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** Status values available for filtering */
const FILTER_STATUSES = ['all', 'backlog', 'todo', 'doing'] as const;
type FilterStatus = (typeof FILTER_STATUSES)[number];

/** Preset colors for categories */
const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6b7280', '#78716c',
];

export interface BacklogColumnHandle {
  openNewTask: () => void;
  focusSearch: () => void;
}

export const BacklogColumn = forwardRef<BacklogColumnHandle, {
  tasks: Task[];
  categories: Category[];
  onNew: (title: string, minutes: number, categoryId?: string | null, dueDate?: string | null) => void;
  onUpdate: (id: string, patch: Partial<Pick<Task, 'status' | 'priority' | 'title' | 'description' | 'estimatedMinutes' | 'categoryId' | 'dueDate'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateCategory: (payload: { name: string; color?: string }) => Promise<Category>;
  onUpdateCategory: (id: string, patch: { name?: string; color?: string }) => Promise<Category>;
  onDeleteCategory: (id: string) => Promise<void>;
}>(function BacklogColumn({ tasks, categories, onNew, onUpdate, onDelete, onCreateCategory, onUpdateCategory, onDeleteCategory }, ref) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    openNewTask: () => setNewTaskOpen(true),
    focusSearch: () => searchRef.current?.focus(),
  }));

  /** Non-archived/non-done tasks, filtered by search + status + category, sorted by overdue → due date → priority → title */
  const visible = useMemo(() => {
    const pool = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
    const q = search.toLowerCase().trim();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return pool
      .filter(t => filter === 'all' || t.status === filter)
      .filter(t => categoryFilter === null || t.categoryId === categoryFilter)
      .filter(t => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) => {
        // Overdue / due-soonest first
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (aDue !== bDue) return aDue - bDue;
        return a.priority - b.priority || a.title.localeCompare(b.title);
      });
  }, [tasks, search, filter, categoryFilter]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  return (
    <aside className="w-64 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Backlog</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setCategoryManagerOpen(true)} title="Manage categories">
            <Tag className="size-3.5" />
          </Button>
          <NewTaskDialog categories={categories} onCreate={onNew} open={newTaskOpen} onOpenChange={setNewTaskOpen} />
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 pl-7 text-xs"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1">
        {FILTER_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
              filter === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30',
            )}
          >
            {s === 'all' ? 'All' : STATUS_META[s].label}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setCategoryFilter(null)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
              categoryFilter === null
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30',
            )}
          >
            All categories
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1',
                categoryFilter === c.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/30',
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {visible.map(t => (
          <DraggableTaskCard key={t.id} task={t} category={t.categoryId ? categoryMap.get(t.categoryId) : undefined} categories={categories} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {search || filter !== 'all' || categoryFilter ? 'No matching tasks.' : 'No tasks. Click + New.'}
          </p>
        )}
      </div>

      {/* Category manager dialog */}
      <CategoryManagerDialog
        categories={categories}
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        onCreate={onCreateCategory}
        onUpdate={onUpdateCategory}
        onDelete={onDeleteCategory}
      />
    </aside>
  );
});

function CategoryManagerDialog({ categories, open, onOpenChange, onCreate, onUpdate, onDelete }: {
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: { name: string; color?: string }) => Promise<Category>;
  onUpdate: (id: string, patch: { name?: string; color?: string }) => Promise<Category>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await onCreate({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor(CATEGORY_COLORS[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate() {
    if (!editingId || !editName.trim()) return;
    setBusy(true);
    try {
      await onUpdate(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await onDelete(id);
      if (editingId === id) setEditingId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>Create and organize categories for your tasks.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          {/* Create new category */}
          <div className="space-y-2">
            <Label>New category</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Category name…"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  disabled={busy}
                />
              </div>
              <div className="flex items-center gap-1">
                {CATEGORY_COLORS.slice(0, 6).map(c => (
                  <button
                    key={c}
                    className={cn('size-5 rounded-full border-2 transition-transform', newColor === c ? 'scale-110 border-foreground' : 'border-transparent')}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
              <Button size="sm" onClick={handleCreate} disabled={busy || !newName.trim()}>
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Existing categories */}
          <div className="space-y-2">
            <Label>Categories</Label>
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">No categories yet.</p>
            )}
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2">
                {editingId === cat.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                      className="h-8 flex-1"
                      disabled={busy}
                    />
                    <div className="flex items-center gap-1">
                      {CATEGORY_COLORS.slice(0, 6).map(c => (
                        <button
                          key={c}
                          className={cn('size-4 rounded-full border-2 transition-transform', editColor === c ? 'scale-110 border-foreground' : 'border-transparent')}
                          style={{ backgroundColor: c }}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={handleUpdate} disabled={busy || !editName.trim()}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1 text-sm">{cat.name}</span>
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => startEdit(cat)} disabled={busy}>
                      <Tag className="size-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-6 text-destructive hover:text-destructive" onClick={() => handleDelete(cat.id)} disabled={busy}>
                      <X className="size-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
