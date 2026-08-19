import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Archive, ArrowUpDown, CheckCircle2, CheckSquare, ChevronDown, ChevronRight,
  Clock, Copy, Edit3, FileSpreadsheet, Link2, ListChecks, Palette, Pencil, Pin, PinOff, PlayCircle, Plus, Search, Square, Tag, Trash2, X,
  Zap, Sparkles, Filter, FilterX, SlidersHorizontal, Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { parseQuickAdd } from '@/lib/parse-quick-add';
import { useTasksKeyboardShortcuts } from '@/lib/use-tasks-keyboard-shortcuts';
import { fetchSmartEstimate, getConfidenceColor, getConfidenceIcon } from '@/lib/time-estimator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BulkImportDialog } from '@/components/bulk-import-dialog';
import { TaskReminderSettings } from '@/components/task-reminder-settings';
import { TaskDependencySelector } from '@/components/task-dependency-selector';
import { LabelInput } from '@/components/label-input';
import { TaskTemplates } from '@/components/task-templates';
import { DependencyGraph } from '@/components/tasks/dependency-graph';
import { DependencyList } from '@/components/tasks/dependency-list';
import { RecurringTaskPreview } from '@/components/recurring-task-preview';
import { SmartScheduleRecommendations } from '@/components/smart-schedule-recommendations';
import { TaskAgeIndicator } from '@/components/tasks/task-age-indicator';

/* ─── Types ─── */

type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done' | 'archived';
type SmartView = 'all' | 'active' | 'done' | 'archived' | 'today' | 'upcoming' | 'overdue' | 'dependencies';

interface Subtask { id: string; title: string; done: boolean }

interface Task {
  id: string; title: string; description: string | null;
  status: TaskStatus; priority: number; estimatedMinutes: number;
  dueDate: string | null; categoryId: string | null; projectId: string | null; isPinned: boolean;
  subtasks: Subtask[];
  labels: string[];
  blockedByTaskIds: string[];
  reminderEnabled: boolean;
  reminderMinutes: number | null;
  recurringRule: {
    freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    byDay?: number[];
    interval?: number;
    endsAfterOccurrences?: number | null;
    endsOnDate?: string | null;
    defaultTime?: string;
    defaultDurationMinutes?: number;
  } | null;
  createdAt: string; updatedAt: string;
}

interface Category { id: string; name: string; color: string }
interface Project { id: string; name: string; color: string; status: string }

/* ─── Constants ─── */

const PRIORITY_LABEL: Record<number, { label: string; cls: string }> = {
  1: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
  2: { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  3: { label: 'Normal', cls: 'bg-muted text-muted-foreground border-border' },
  4: { label: 'Low', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  5: { label: 'Someday', cls: 'bg-muted text-muted-foreground border-border' },
};

const STATUS_META: Record<TaskStatus, { label: string; icon: typeof CheckCircle2; color: string }> = {
  backlog:  { label: 'Backlog',     icon: Archive,      color: 'text-slate-500' },
  todo:     { label: 'To Do',       icon: Clock,        color: 'text-blue-500' },
  doing:    { label: 'In Progress', icon: PlayCircle,   color: 'text-amber-500' },
  done:     { label: 'Done',        icon: CheckCircle2, color: 'text-emerald-500' },
  archived: { label: 'Archived',    icon: Archive,      color: 'text-slate-400' },
};

const STATUS_OPTIONS: TaskStatus[] = ['backlog', 'todo', 'doing', 'done', 'archived'];

const SORT_OPTIONS = [
  { value: 'smart',     label: 'Smart (priority + due)' },
  { value: 'priority',  label: 'Priority' },
  { value: 'dueDate',   label: 'Due date' },
  { value: 'estimated', label: 'Estimated time' },
  { value: 'title',     label: 'Title A-Z' },
  { value: 'created',   label: 'Newest first' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];

/* ─── Smart-view helpers (client-side, uses local date) ─── */

function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = startOfToday();
  return d >= t && d < new Date(t.getTime() + 86_400_000);
}

function isUpcoming(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = startOfToday();
  const end = new Date(t.getTime() + 7 * 86_400_000);
  return d >= t && d < end;
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  const d = new Date(task.dueDate);
  return d < startOfToday() && task.status !== 'done' && task.status !== 'archived';
}

/* ─── Page ─── */

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [smartView, setSmartView] = useState<SmartView>('active');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('smart');

  // Advanced filters
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [priorityFilters, setPriorityFilters] = useState<number[]>([]);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [estimatedTimeMin, setEstimatedTimeMin] = useState<number | null>(null);
  const [estimatedTimeMax, setEstimatedTimeMax] = useState<number | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [hasSubtasksOnly, setHasSubtasksOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Quick-add bar state
  const [quickInput, setQuickInput] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickPreview, setQuickPreview] = useState<ReturnType<typeof parseQuickAdd> | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSmartSchedule, setShowSmartSchedule] = useState<string | null>(null);
  const [depsFullscreen, setDepsFullscreen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Build query parameters for server-side filtering
      const params = new URLSearchParams();
      if (search.trim()) {
        params.append('search', search.trim());
      }
      if (smartView !== 'all') {
        params.append('view', smartView);
      }
      if (labelFilter) {
        params.append('label', labelFilter);
      }

      const queryString = params.toString();
      const url = queryString ? `/api/tasks?${queryString}` : '/api/tasks';

      const [t, c, p] = await Promise.all([
        apiFetch<Task[]>(url),
        apiFetch<Category[]>('/api/categories'),
        apiFetch<Project[]>('/api/projects?action=list'),
      ]);
      setTasks(t);
      setCategories(c);
      setProjects(p);
    } catch (e) { setLoadError((e as Error).message || 'Failed to load tasks'); }
    finally { setLoading(false); }
  }, [search, smartView, labelFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onTaskCreated() { load(); }
    window.addEventListener('task-created', onTaskCreated);
    return () => window.removeEventListener('task-created', onTaskCreated);
  }, [load]);

  // Live quick-add preview
  useEffect(() => {
    if (!quickInput.trim()) { setQuickPreview(null); return; }
    setQuickPreview(parseQuickAdd(quickInput));
  }, [quickInput]);

  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  // Collect all labels across tasks for filter suggestions
  const allLabels = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach(t => (t.labels ?? []).forEach(l => s.add(l)));
    return [...s].sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks
      .filter(t => {
        switch (smartView) {
          case 'active':   return t.status !== 'done' && t.status !== 'archived';
          case 'done':     return t.status === 'done';
          case 'archived': return t.status === 'archived';
          case 'today':    return isToday(t.dueDate);
          case 'upcoming': return isUpcoming(t.dueDate) && !isToday(t.dueDate);
          case 'overdue':  return isOverdue(t);
          default:         return true; // 'all'
        }
      })
      .filter(t => categoryFilter === null || t.categoryId === categoryFilter)
      // Note: search and label filtering are now handled server-side
      // Advanced filters
      .filter(t => priorityFilters.length === 0 || priorityFilters.includes(t.priority))
      .filter(t => projectFilter === null || t.projectId === projectFilter)
      .filter(t => estimatedTimeMin === null || t.estimatedMinutes >= estimatedTimeMin)
      .filter(t => estimatedTimeMax === null || t.estimatedMinutes <= estimatedTimeMax)
      .filter(t => !pinnedOnly || t.isPinned)
      .filter(t => !hasSubtasksOnly || (t.subtasks && t.subtasks.length > 0))
      .filter(t => !overdueOnly || isOverdue(t))
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
        // smart: due date then priority then title
        const aD = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bD = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        if (aD !== bD) return aD - bD;
        return a.priority - b.priority || a.title.localeCompare(b.title);
      });
  }, [tasks, smartView, categoryFilter, sortBy, priorityFilters, projectFilter, estimatedTimeMin, estimatedTimeMax, pinnedOnly, hasSubtasksOnly, overdueOnly]);

  async function updateTask(id: string, patch: Partial<Task>) {
    setBusyId(id);
    try {
      await apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
      toast.success('Task updated');

      // Check for achievements when task is completed
      if (patch.status === 'done') {
        apiFetch('/api/achievements?action=check', { method: 'POST' })
          .then((data: any) => {
            if (data.unlocked && data.unlocked.length > 0) {
              data.unlocked.forEach((achievement: any, index: number) => {
                setTimeout(() => {
                  toast.success(`Achievement Unlocked: ${achievement.icon} ${achievement.name}`, {
                    description: achievement.description,
                    duration: 5000,
                  });
                }, index * 1500);
              });
            }
          })
          .catch(console.error);
      }
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

  // Helper functions for advanced filters
  const hasAdvancedFilters = useMemo(() => {
    return priorityFilters.length > 0 ||
           projectFilter !== null ||
           estimatedTimeMin !== null ||
           estimatedTimeMax !== null ||
           pinnedOnly ||
           hasSubtasksOnly ||
           overdueOnly;
  }, [priorityFilters, projectFilter, estimatedTimeMin, estimatedTimeMax, pinnedOnly, hasSubtasksOnly, overdueOnly]);

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (priorityFilters.length > 0) count++;
    if (projectFilter !== null) count++;
    if (estimatedTimeMin !== null || estimatedTimeMax !== null) count++;
    if (pinnedOnly) count++;
    if (hasSubtasksOnly) count++;
    if (overdueOnly) count++;
    return count;
  }, [priorityFilters, projectFilter, estimatedTimeMin, estimatedTimeMax, pinnedOnly, hasSubtasksOnly, overdueOnly]);

  const clearAdvancedFilters = useCallback(() => {
    setPriorityFilters([]);
    setProjectFilter(null);
    setEstimatedTimeMin(null);
    setEstimatedTimeMax(null);
    setPinnedOnly(false);
    setHasSubtasksOnly(false);
    setOverdueOnly(false);
  }, []);

  const togglePriorityFilter = useCallback((priority: number) => {
    setPriorityFilters(prev =>
      prev.includes(priority)
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
  }, []);

  async function duplicateTask(task: Task) {
    setBusyId(task.id);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: `${task.title} (copy)`,
          description: task.description,
          estimatedMinutes: task.estimatedMinutes,
          priority: task.priority,
          categoryId: task.categoryId,
          dueDate: task.dueDate,
          labels: task.labels ?? [],
          status: 'todo',
        }),
      });
      toast.success('Task duplicated');
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function createTaskFromTemplate(templateWithValues: any) {
    try {
      const templateId = templateWithValues.id;
      const variableValues = templateWithValues.variableValues || {};
      await apiFetch('/api/tasks?action=apply-template&templateId=' + templateId, {
        method: 'POST',
        body: JSON.stringify({ variableValues }),
      });
      toast.success('Task created from template');
      setTemplatesOpen(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  // Quick-add submit: parse NL input and create task
  async function submitQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const raw = quickInput.trim();
    if (!raw) return;
    setQuickBusy(true);
    try {
      const parsed = parseQuickAdd(raw);
      if (!parsed.title) { toast.error('Could not extract a title'); return; }

      // Resolve categoryName to categoryId
      let categoryId: string | null = null;
      if (parsed.categoryName) {
        const match = categories.find(c => c.name.toLowerCase() === parsed.categoryName!.toLowerCase());
        categoryId = match?.id ?? null;
      }

      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: parsed.title,
          status: 'todo',
          priority: parsed.priority ?? 3,
          estimatedMinutes: 60,
          categoryId,
          dueDate: parsed.dueDate ?? null,
          labels: parsed.labels ?? [],
        }),
      });
      toast.success('Task created');
      setQuickInput('');
      setQuickPreview(null);
      load();
    } catch (err) { toast.error((err as Error).message); }
    finally { setQuickBusy(false); }
  }

  const counts = useMemo(() => {
    const c = { backlog: 0, todo: 0, doing: 0, done: 0, archived: 0 };
    tasks.forEach(t => c[t.status]++);
    const today = tasks.filter(t => isToday(t.dueDate)).length;
    const upcoming = tasks.filter(t => isUpcoming(t.dueDate) && !isToday(t.dueDate)).length;
    const overdue = tasks.filter(isOverdue).length;
    return { ...c, today, upcoming, overdue };
  }, [tasks]);

  // Keyboard shortcuts for task navigation
  const filteredIds = useMemo(() => filtered.map(t => t.id), [filtered]);

  useTasksKeyboardShortcuts({
    taskIds: filteredIds,
    highlightedId,
    setHighlightedId,
    onExpand: (id) => setExpandedId(prev => prev === id ? null : id),
    onEdit: (id) => { const t = tasks.find(x => x.id === id); if (t) setEditTask(t); },
    onStatusCycle: (id) => {
      const t = tasks.find(x => x.id === id);
      if (!t) return;
      const next: Record<TaskStatus, TaskStatus> = {
        backlog: 'todo', todo: 'doing', doing: 'done', done: 'archived', archived: 'backlog',
      };
      updateTask(id, { status: next[t.status] });
    },
    onSetPriority: (id, priority) => updateTask(id, { priority }),
    onToggleSelect: (id) => toggleSelect(id),
    onDelete: (id) => deleteTask(id),
    onNewTask: () => setNewOpen(true),
    onFocusSearch: () => searchRef.current?.focus(),
  });

  const selectedCount = selectedIds.size;

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  }

  function clearSelection() { setSelectedIds(new Set()); }

  async function bulkSetStatus(status: TaskStatus) {
    setBulkBusy(true);
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map(id =>
        apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      ));
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status } : t));
      toast.success(`${ids.length} task${ids.length > 1 ? 's' : ''} moved to ${STATUS_META[status].label}`);
      clearSelection();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBulkBusy(false); }
  }

  async function bulkSetPriority(priority: number) {
    setBulkBusy(true);
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map(id =>
        apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ priority }) })
      ));
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, priority } : t));
      toast.success(`${ids.length} task${ids.length > 1 ? 's' : ''} set to ${PRIORITY_LABEL[priority]?.label ?? 'Normal'}`);
      clearSelection();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBulkBusy(false); }
  }

  async function bulkDelete() {
    setBulkBusy(true);
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map(id =>
        apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
      ));
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
      toast.success(`${ids.length} task${ids.length > 1 ? 's' : ''} deleted`);
      clearSelection();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBulkBusy(false); }
  }

  async function bulkSetCategory(categoryId: string) {
    setBulkBusy(true);
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map(id =>
        apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ categoryId: categoryId === 'none' ? null : categoryId }) })
      ));
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, categoryId: categoryId === 'none' ? null : categoryId } : t));
      const targetCategory = categoryId === 'none' ? 'uncategorized' : categories.find(c => c.id === categoryId)?.name || 'unknown';
      toast.success(`${ids.length} task${ids.length > 1 ? 's' : ''} moved to ${targetCategory}`);
      clearSelection();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBulkBusy(false); }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        </div>
        <Card>
          <CardContent className="p-10 text-center">
            <AlertTriangle className="mx-auto size-10 text-destructive/50 mb-3" />
            <p className="text-sm font-medium text-destructive">Failed to load tasks</p>
            <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const smartViewTabs: { key: SmartView; label: string; count: number }[] = [
    { key: 'active',   label: 'Active',    count: counts.todo + counts.doing + counts.backlog },
    { key: 'today',    label: 'Today',     count: counts.today },
    { key: 'upcoming', label: 'Upcoming',  count: counts.upcoming },
    { key: 'overdue',  label: 'Overdue',   count: counts.overdue },
    { key: 'dependencies', label: 'Dependencies', count: tasks.filter(t => t.blockedByTaskIds && t.blockedByTaskIds.length > 0).length },
    { key: 'done',     label: 'Done',      count: counts.done },
    { key: 'archived', label: 'Archived',  count: counts.archived },
    { key: 'all',      label: 'All',       count: tasks.length },
  ];

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            <Sparkles className="size-4 mr-1.5" /> Templates
          </Button>
          <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
            <FileSpreadsheet className="size-4 mr-1.5" /> Bulk import
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4 mr-1.5" /> New task
          </Button>
        </div>
      </div>

      {/* Quick-add bar */}
      <form onSubmit={submitQuickAdd} className="space-y-1.5">
        <div className="relative flex items-center gap-2">
          <Zap className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder='Quick add: "draft report fri 3pm !p1 #work @home"'
            value={quickInput}
            onChange={e => setQuickInput(e.target.value)}
            className="pl-9 h-10"
            aria-label="Quick-add task with natural language"
          />
          <Button type="submit" size="sm" disabled={!quickInput.trim() || quickBusy} className="shrink-0">
            {quickBusy ? '…' : 'Add'}
          </Button>
        </div>
        {quickPreview && quickInput.trim() && (
          <div className="flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">"{quickPreview.title}"</span>
            {quickPreview.dueDate && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {quickPreview.dueDate}{quickPreview.dueTime ? ` ${quickPreview.dueTime}` : ''}
              </Badge>
            )}
            {quickPreview.priority && (
              <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', PRIORITY_LABEL[quickPreview.priority]?.cls)}>
                {PRIORITY_LABEL[quickPreview.priority]?.label}
              </Badge>
            )}
            {quickPreview.categoryName && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                #{quickPreview.categoryName}
              </Badge>
            )}
            {(quickPreview.labels ?? []).map(l => (
              <Badge key={l} variant="outline" className="text-[10px] px-1.5 py-0">
                @{l}
              </Badge>
            ))}
          </div>
        )}
      </form>

      {/* Smart view tabs */}
      <div className="flex flex-wrap gap-2">
        {smartViewTabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setSmartView(key)}
            aria-pressed={smartView === key}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              smartView === key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30',
              key === 'overdue' && count > 0 && smartView !== key && 'border-red-300 text-red-600',
            )}
          >
            {label}
            <span className="ml-1.5 opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search tasks... (press / to focus)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-8 pr-16"
          />
          {search && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">
                {filtered.length}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => setSearch('')}
              >
                <X className="size-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Category filter */}
        <Select value={categoryFilter ?? 'all'} onValueChange={v => setCategoryFilter(v === 'all' ? null : v)}>
          <SelectTrigger className="h-9 w-auto min-w-[140px]">
            <Tag className="size-3.5 mr-1.5" />
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
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

        {/* Label filter */}
        {allLabels.length > 0 && (
          <Select value={labelFilter ?? 'all'} onValueChange={v => setLabelFilter(v === 'all' ? null : v)}>
            <SelectTrigger className="h-9 w-auto min-w-[120px]">
              <Tag className="size-3.5 mr-1.5" />
              <SelectValue placeholder="All labels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All labels</SelectItem>
              {allLabels.map(l => (
                <SelectItem key={l} value={l}>@{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button size="sm" variant="outline" className="h-9" onClick={() => setCatManagerOpen(true)}>
          <Palette className="size-3.5 mr-1.5" /> Projects
        </Button>

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

        {/* Advanced Filters Toggle */}
        <Collapsible open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button
              size="sm"
              variant={hasAdvancedFilters ? "default" : "outline"}
              className="h-9 relative"
            >
              <SlidersHorizontal className="size-3.5 mr-1.5" />
              Advanced
              {hasAdvancedFilters && (
                <Badge className="ml-1.5 h-5 px-1.5 text-xs">{activeAdvancedFilterCount}</Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Advanced Filters Panel */}
      <Collapsible open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
        <CollapsibleContent className="space-y-4">
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-4">
              {/* Header with clear button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-muted-foreground" />
                  <span className="font-medium">Advanced Filters</span>
                  {hasAdvancedFilters && (
                    <Badge variant="secondary" className="text-xs">
                      {activeAdvancedFilterCount} active
                    </Badge>
                  )}
                </div>
                {hasAdvancedFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={clearAdvancedFilters}
                  >
                    <FilterX className="size-3 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Priority Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Priority</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5].map(p => (
                      <button
                        key={p}
                        onClick={() => togglePriorityFilter(p)}
                        className={cn(
                          "px-2 py-1 rounded-md text-xs font-medium border transition-all",
                          priorityFilters.includes(p)
                            ? PRIORITY_LABEL[p].cls + " border-current"
                            : "bg-background hover:bg-muted/50"
                        )
                      }
                      >
                        {PRIORITY_LABEL[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Project Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Project</Label>
                  <Select
                    value={projectFilter ?? 'all'}
                    onValueChange={v => setProjectFilter(v === 'all' ? null : v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All projects</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            {p.name}
                            {p.status !== 'active' && (
                              <Badge variant="outline" className="text-xs py-0 px-1">
                                {p.status}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Estimated Time Range */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Estimated Time (min)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      min={0}
                      value={estimatedTimeMin ?? ''}
                      onChange={e => setEstimatedTimeMin(e.target.value ? parseInt(e.target.value) : null)}
                      className="h-8 text-sm"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      min={0}
                      value={estimatedTimeMax ?? ''}
                      onChange={e => setEstimatedTimeMax(e.target.value ? parseInt(e.target.value) : null)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {/* Quick Filters */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Quick Filters</Label>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pinnedOnly}
                        onChange={e => setPinnedOnly(e.target.checked)}
                        className="rounded"
                      />
                      <Pin className="size-3" /> Pinned
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasSubtasksOnly}
                        onChange={e => setHasSubtasksOnly(e.target.checked)}
                        className="rounded"
                      />
                      <ListChecks className="size-3" /> Subtasks
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overdueOnly}
                        onChange={e => setOverdueOnly(e.target.checked)}
                        className="rounded"
                      />
                      <AlertTriangle className="size-3" /> Overdue
                    </label>
                  </div>
                </div>
              </div>

              {/* Active Filters Display */}
              {hasAdvancedFilters && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {priorityFilters.length > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      Priority: {priorityFilters.map(p => PRIORITY_LABEL[p].label).join(', ')}
                      <X
                        className="size-3 cursor-pointer"
                        onClick={() => setPriorityFilters([])}
                      />
                    </Badge>
                  )}
                  {projectFilter && (
                    <Badge variant="secondary" className="gap-1">
                      Project: {projects.find(p => p.id === projectFilter)?.name}
                      <X
                        className="size-3 cursor-pointer"
                        onClick={() => setProjectFilter(null)}
                      />
                    </Badge>
                  )}
                  {(estimatedTimeMin !== null || estimatedTimeMax !== null) && (
                    <Badge variant="secondary" className="gap-1">
                      Time: {estimatedTimeMin ?? '0'} - {estimatedTimeMax ?? '∞'} min
                      <X
                        className="size-3 cursor-pointer"
                        onClick={() => { setEstimatedTimeMin(null); setEstimatedTimeMax(null); }}
                      />
                    </Badge>
                  )}
                  {pinnedOnly && (
                    <Badge variant="secondary" className="gap-1">
                      <Pin className="size-3" /> Pinned
                      <X className="size-3 cursor-pointer" onClick={() => setPinnedOnly(false)} />
                    </Badge>
                  )}
                  {hasSubtasksOnly && (
                    <Badge variant="secondary" className="gap-1">
                      <ListChecks className="size-3" /> Has subtasks
                      <X className="size-3 cursor-pointer" onClick={() => setHasSubtasksOnly(false)} />
                    </Badge>
                  )}
                  {overdueOnly && (
                    <Badge variant="secondary" className="gap-1">
                      <AlertTriangle className="size-3" /> Overdue
                      <X className="size-3 cursor-pointer" onClick={() => setOverdueOnly(false)} />
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Active label filter chip */}
      {labelFilter && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Label:</span>
          <button
            onClick={() => setLabelFilter(null)}
            className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            @{labelFilter} <X className="size-3 ml-0.5" />
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5">
          <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-4" />
          </button>
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Select onValueChange={v => bulkSetStatus(v as TaskStatus)} disabled={bulkBusy}>
              <SelectTrigger className="h-7 w-auto text-xs">
                <SelectValue placeholder="Set status..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={v => bulkSetPriority(Number(v))} disabled={bulkBusy}>
              <SelectTrigger className="h-7 w-auto text-xs">
                <SelectValue placeholder="Set priority..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABEL).map(([v, { label }]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={v => bulkSetCategory(v)} disabled={bulkBusy}>
              <SelectTrigger className="h-7 w-auto text-xs">
                <Tag className="size-3 mr-1" />
                <SelectValue placeholder="Set project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
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
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" disabled={bulkBusy} onClick={bulkDelete}>
              <Trash2 className="size-3" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Dependencies view */}
      {smartView === 'dependencies' && (
        <div className="space-y-6">
          <DependencyGraph
            tasks={tasks}
            onTaskClick={(id) => {
              const task = tasks.find(t => t.id === id);
              if (task) setEditTask(task);
            }}
            fullscreen={depsFullscreen}
            onToggleFullscreen={() => setDepsFullscreen(!depsFullscreen)}
          />
          <DependencyList
            tasks={tasks}
            onTaskClick={(id) => {
              const task = tasks.find(t => t.id === id);
              if (task) setEditTask(task);
            }}
          />
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <CheckCircle2 className="mx-auto size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search || smartView !== 'all' || categoryFilter || labelFilter ? 'No matching tasks' : 'No tasks yet'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {search ? 'Try a different search term' : 'Click "New task" or use quick-add above'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {/* Select all header */}
          <div className="flex items-center gap-2 px-2 py-1">
            <button
              onClick={toggleSelectAll}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
            >
              {selectedIds.size === filtered.length && filtered.length > 0
                ? <CheckSquare className="size-4" />
                : <Square className="size-4" />}
            </button>
            <span className="text-xs text-muted-foreground">
              {selectedCount > 0 ? `${selectedCount} of ${filtered.length} selected` : `${filtered.length} task${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {filtered.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              category={task.categoryId ? catMap.get(task.categoryId) : undefined}
              busy={busyId === task.id}
              selected={selectedIds.has(task.id)}
              isHighlighted={highlightedId === task.id}
              isExpanded={expandedId === task.id}
              onToggleSelect={() => toggleSelect(task.id)}
              onToggleExpand={() => setExpandedId(prev => prev === task.id ? null : task.id)}
              onStatusChange={(status) => updateTask(task.id, { status })}
              onEdit={() => setEditTask(task)}
              onDelete={() => deleteTask(task.id)}
              onDuplicate={() => duplicateTask(task)}
              onPin={() => updateTask(task.id, { isPinned: !task.isPinned })}
              onLabelClick={setLabelFilter}
              onSmartSchedule={() => setShowSmartSchedule(task.id)}
            />
          ))}
        </div>
      )}

      {/* New task dialog */}
      <NewTaskDialog open={newOpen} onOpenChange={setNewOpen} categories={categories} projects={projects} availableLabels={allLabels} onCreated={load} />

      {/* Edit task dialog */}
      {editTask && (
        <EditTaskDialog
          task={editTask}
          categories={categories}
          projects={projects}
          availableLabels={allLabels}
          onClose={() => setEditTask(null)}
          onSaved={load}
        />
      )}

      {/* Bulk import dialog */}
      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        categories={categories}
        onDone={load}
      />

      {/* Category manager dialog (renamed Projects in UI) */}
      <CategoryManagerDialog
        open={catManagerOpen}
        onOpenChange={setCatManagerOpen}
        categories={categories}
        onSaved={load}
      />

      {/* Templates dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Task Templates</DialogTitle>
            <DialogDescription>
              Create reusable task templates for common workflows like daily standups, weekly reviews, or monthly reports.
            </DialogDescription>
          </DialogHeader>
          <TaskTemplates onSelectTemplate={(template) => createTaskFromTemplate(template.id)} />
        </DialogContent>
      </Dialog>

      {/* Smart Schedule dialog */}
      <Dialog open={showSmartSchedule !== null} onOpenChange={() => setShowSmartSchedule(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Smart Schedule Analysis</DialogTitle>
            <DialogDescription>
              AI-powered scheduling recommendations based on your energy patterns and historical data
            </DialogDescription>
          </DialogHeader>
          {showSmartSchedule && (
            <SmartScheduleRecommendations
              taskId={showSmartSchedule}
              onScheduleSlot={(date, startTime, endTime) => {
                toast.success(`Schedule suggested: ${date} ${startTime}-${endTime}`);
                setShowSmartSchedule(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Task Row ─── */

function TaskRow({ task, category, busy, selected, isHighlighted, isExpanded, onToggleSelect, onToggleExpand, onStatusChange, onEdit, onDelete, onDuplicate, onPin, onLabelClick, onSmartSchedule }: {
  task: Task; category?: Category; busy: boolean; selected: boolean;
  isHighlighted: boolean; isExpanded: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void;
  onStatusChange: (s: TaskStatus) => void; onEdit: () => void; onDelete: () => void; onDuplicate: () => void; onPin: () => void;
  onLabelClick: (label: string) => void;
  onSmartSchedule: () => void;
}) {
  const prio = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL[3];
  const meta = STATUS_META[task.status];
  const StatusIcon = meta.icon;

  const estH = Math.floor(task.estimatedMinutes / 60);
  const estM = task.estimatedMinutes % 60;
  const estStr = estH > 0 ? (estM ? `${estH}h${estM}m` : `${estH}h`) : `${estM}m`;

  const overdue = isOverdue(task);

  return (
    <div
      data-task-id={task.id}
      className={cn(
        'group rounded-lg bg-card transition-all shadow-soft hover:shadow-soft-md',
        task.isPinned && 'ring-1 ring-primary/20',
        overdue && 'border border-red-200 bg-red-50/30',
        isHighlighted && 'ring-2 ring-primary shadow-soft-md',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Expand toggle */}
        <button onClick={onToggleExpand} className="text-muted-foreground hover:text-foreground shrink-0">
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        {/* Selection checkbox */}
        <button
          onClick={onToggleSelect}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={selected ? 'Deselect task' : 'Select task'}
        >
          {selected
            ? <CheckSquare className="size-4 text-primary" />
            : <Square className="size-4" />}
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
          title={`Status: ${meta.label} (click to advance)`}
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
            {task.isPinned && <Pin className="size-3 text-primary shrink-0" />}
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
                overdue ? 'text-red-600 font-medium' : 'text-muted-foreground',
              )}>
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {task.blockedByTaskIds && task.blockedByTaskIds.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 bg-amber-50 border-amber-200 text-amber-700">
                <Link2 className="size-3" />
                Blocked by {task.blockedByTaskIds.length}
              </Badge>
            )}
            {category && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                {category.name}
              </span>
            )}
            {task.subtasks && task.subtasks.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-violet-600 font-medium">
                <ListChecks className="size-3" />
                {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
              </span>
            )}
            <TaskAgeIndicator updatedAt={task.updatedAt} compact />
            {/* Label chips */}
            {(task.labels ?? []).map(l => (
              <button
                key={l}
                onClick={() => onLabelClick(l)}
                className="text-[10px] rounded-full bg-muted border border-border px-1.5 py-0 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                title={`Filter by @${l}`}
              >
                @{l}
              </button>
            ))}
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
          <Button size="icon" variant="ghost" className="size-7" title="Duplicate"
            disabled={busy} onClick={onDuplicate}>
            <Copy className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-7"
            title={task.isPinned ? 'Unpin task' : 'Pin task'}
            aria-label={task.isPinned ? 'Unpin task' : 'Pin task'}
            disabled={busy} onClick={onPin}>
            {task.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" title="Delete"
            disabled={busy} onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="divider-t px-4 py-3 pl-14 space-y-2 text-sm">
          {task.description && (
            <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          )}
          {/* Dependencies section */}
          {task.blockedByTaskIds && task.blockedByTaskIds.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <Link2 className="size-3" />
                <span>Blocked by {task.blockedByTaskIds.length} task{task.blockedByTaskIds.length > 1 ? 's' : ''}</span>
              </div>
              <div className="text-xs text-muted-foreground pl-4">
                This task cannot be started until the blocking tasks are completed.
              </div>
            </div>
          )}
          {/* Subtasks checklist */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="space-y-1">
              {task.subtasks.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className={cn(
                    'size-3.5 rounded border flex items-center justify-center shrink-0',
                    s.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30',
                  )}>
                    {s.done && <CheckCircle2 className="size-2.5" />}
                  </span>
                  <span className={cn('text-xs', s.done && 'line-through text-muted-foreground')}>{s.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recurring task preview */}
          {task.recurringRule && (
            <div className="mt-3">
              <RecurringTaskPreview
                title={task.title}
                startDate={task.dueDate ? new Date(task.dueDate) : new Date()}
                recurringRule={task.recurringRule}
                maxInstances={6}
                className="border-border/50 bg-muted/30"
              />
            </div>
          )}
          {/* Smart schedule button */}
          {task.status !== 'done' && task.status !== 'archived' && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs mt-2"
              onClick={onSmartSchedule}
            >
              <Sparkles className="size-3 mr-1" />
              Smart Schedule
            </Button>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Status: <strong className="text-foreground">{meta.label}</strong></span>
            <span>Created: {fmtShortDate(new Date(task.createdAt))}</span>
            {task.dueDate && <span>Due: {fmtShortDate(new Date(task.dueDate))}</span>}
          </div>
          {/* Labels in expanded view */}
          {(task.labels ?? []).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">Labels:</span>
              {(task.labels ?? []).map(l => (
                <span key={l} className="text-[10px] rounded-full bg-muted border border-border px-1.5 py-0 text-muted-foreground">
                  @{l}
                </span>
              ))}
            </div>
          )}
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

/* ─── Label input component ─── */

/* ─── New Task Dialog ─── */

function NewTaskDialog({ open, onOpenChange, categories, projects, availableLabels, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; categories: Category[]; projects: Project[]; availableLabels: string[]; onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [priority, setPriority] = useState(3);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [repeatFreq, setRepeatFreq] = useState<'none' | 'daily' | 'weekly'>('none');
  const [labels, setLabels] = useState<string[]>([]);
  const [blockedByTaskIds, setBlockedByTaskIds] = useState<string[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [smartEstimate, setSmartEstimate] = useState<{ estimate: number; confidence: string; message: string } | null>(null);

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

  function reset() {
    setTitle(''); setMinutes(60); setPriority(3); setCategoryId(null); setProjectId(null);
    setDueDate(''); setRepeatFreq('none'); setLabels([]);
    setBlockedByTaskIds([]);
    setReminderEnabled(false); setReminderMinutes(null);
    setSmartEstimate(null);
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
          categoryId, projectId, dueDate: dueDate || null, status: 'todo',
          labels, blockedByTaskIds,
          reminderEnabled, reminderMinutes,
          recurringRule: repeatFreq === 'none' ? null : {
            freq: repeatFreq,
            interval: 1,
            defaultDurationMinutes: minutes,
          },
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="nt-min">Est. minutes</Label>
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
                  <Input id="nt-min" type="number" min={15} step={15}
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
                <Label id="nt-pri-label">Priority</Label>
                <div role="radiogroup" aria-labelledby="nt-pri-label" className="flex gap-1">
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
                        priority === p.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                      onClick={() => setPriority(p.value)}>{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
            {categories.length > 0 && (
              <div className="space-y-1">
                <Label id="nt-cat-label">Category</Label>
                <div role="radiogroup" aria-labelledby="nt-cat-label" className="flex flex-wrap gap-1">
                  <button type="button"
                    role="radio"
                    aria-checked={categoryId === null}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      categoryId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                    )}
                    onClick={() => setCategoryId(null)}>None</button>
                  {categories.map(c => (
                    <button key={c.id} type="button"
                      role="radio"
                      aria-checked={categoryId === c.id}
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
            {projects.length > 0 && (
              <div className="space-y-1">
                <Label id="nt-proj-label">Project</Label>
                <div role="radiogroup" aria-labelledby="nt-proj-label" className="flex flex-wrap gap-1">
                  <button type="button"
                    role="radio"
                    aria-checked={projectId === null}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      projectId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                    )}
                    onClick={() => setProjectId(null)}>None</button>
                  {projects.filter(p => p.status === 'active').map(p => (
                    <button key={p.id} type="button"
                      role="radio"
                      aria-checked={projectId === p.id}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1',
                        projectId === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                      onClick={() => setProjectId(p.id)}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nt-due">Due date (optional)</Label>
                <Input id="nt-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nt-repeat">Repeat</Label>
                <Select value={repeatFreq} onValueChange={v => setRepeatFreq(v as 'none' | 'daily' | 'weekly')}>
                  <SelectTrigger id="nt-repeat" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Labels</Label>
              <LabelInput labels={labels} onChange={setLabels} availableLabels={availableLabels} />
            </div>
            <TaskDependencySelector
              value={blockedByTaskIds}
              onChange={setBlockedByTaskIds}
            />
            {/* Task Reminders */}
            <TaskReminderSettings
              reminderEnabled={reminderEnabled}
              reminderMinutes={reminderMinutes}
              onReminderEnabledChange={setReminderEnabled}
              onReminderMinutesChange={setReminderMinutes}
            />
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

function EditTaskDialog({ task, categories, projects, availableLabels, onClose, onSaved }: {
  task: Task; categories: Category[]; projects: Project[]; availableLabels: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [minutes, setMinutes] = useState(task.estimatedMinutes);
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [categoryId, setCategoryId] = useState<string | null>(task.categoryId);
  const [projectId, setProjectId] = useState<string | null>(task.projectId);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks ?? []);
  const [labels, setLabels] = useState<string[]>(task.labels ?? []);
  const [blockedByTaskIds, setBlockedByTaskIds] = useState<string[]>(task.blockedByTaskIds ?? []);
  const [reminderEnabled, setReminderEnabled] = useState(task.reminderEnabled ?? false);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(task.reminderMinutes ?? null);
  const [newSubtask, setNewSubtask] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [smartEstimate, setSmartEstimate] = useState<{ estimate: number; confidence: string; message: string } | null>(null);

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

  function addSubtask() {
    const t = newSubtask.trim();
    if (!t) return;
    const id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSubtasks(prev => [...prev, { id, title: t, done: false }]);
    setNewSubtask('');
  }

  function toggleSubtask(id: string) {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
  }

  function removeSubtask(id: string) {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim(), description: description || null,
          estimatedMinutes: minutes, priority, status, categoryId, projectId,
          dueDate: dueDate || null, subtasks, labels, blockedByTaskIds,
          reminderEnabled, reminderMinutes,
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
              <Textarea id="et-desc" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="et-min">Est. minutes</Label>
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
                  <Input id="et-min" type="number" min={15} step={15} value={minutes} onChange={e => setMinutes(Number(e.target.value) || 60)}
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
                <Label id="et-pri-label">Priority</Label>
                <div role="radiogroup" aria-labelledby="et-pri-label" className="flex gap-1">
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
                        priority === p.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                      onClick={() => setPriority(p.value)}>{p.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label id="et-status-label">Status</Label>
              <div role="radiogroup" aria-labelledby="et-status-label" className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map(s => {
                  const m = STATUS_META[s];
                  return (
                    <button key={s} type="button"
                      role="radio"
                      aria-checked={status === s}
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
                <Label id="et-cat-label">Category</Label>
                <div role="radiogroup" aria-labelledby="et-cat-label" className="flex flex-wrap gap-1">
                  <button type="button"
                    role="radio"
                    aria-checked={categoryId === null}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      categoryId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                    )}
                    onClick={() => setCategoryId(null)}>None</button>
                  {categories.map(c => (
                    <button key={c.id} type="button"
                      role="radio"
                      aria-checked={categoryId === c.id}
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
            {projects.length > 0 && (
              <div className="space-y-1">
                <Label id="et-proj-label">Project</Label>
                <div role="radiogroup" aria-labelledby="et-proj-label" className="flex flex-wrap gap-1">
                  <button type="button"
                    role="radio"
                    aria-checked={projectId === null}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      projectId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                    )}
                    onClick={() => setProjectId(null)}>None</button>
                  {projects.filter(p => p.status === 'active').map(p => (
                    <button key={p.id} type="button"
                      role="radio"
                      aria-checked={projectId === p.id}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1',
                        projectId === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                      onClick={() => setProjectId(p.id)}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="et-due">Due date</Label>
              <Input id="et-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            {/* Task Reminders */}
            <TaskReminderSettings
              reminderEnabled={reminderEnabled}
              reminderMinutes={reminderMinutes}
              onReminderEnabledChange={setReminderEnabled}
              onReminderMinutesChange={setReminderMinutes}
            />
            {/* Subtasks */}
            <div className="space-y-1.5">
              <Label>Subtasks {subtasks.length > 0 && `(${subtasks.filter(s => s.done).length}/${subtasks.length})`}</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {subtasks.map(s => (
                  <div key={s.id} className="flex items-center gap-2 group/sub">
                    <button type="button" onClick={() => toggleSubtask(s.id)}
                      className={cn(
                        'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        s.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-foreground/50',
                      )}>
                      {s.done && <CheckCircle2 className="size-3" />}
                    </button>
                    <span className={cn('text-sm flex-1', s.done && 'line-through text-muted-foreground')}>{s.title}</span>
                    <button type="button" onClick={() => removeSubtask(s.id)}
                      className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input placeholder="Add subtask..." value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                  className="h-7 text-xs" />
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs"
                  onClick={addSubtask} disabled={!newSubtask.trim()}>
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            {/* Labels */}
            <div className="space-y-1">
              <Label>Labels</Label>
              <LabelInput labels={labels} onChange={setLabels} availableLabels={availableLabels} />
            </div>
            <TaskDependencySelector
              value={blockedByTaskIds}
              onChange={setBlockedByTaskIds}
              excludeTaskId={task.id}
            />
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

/* ─── Category Manager Dialog ─── */

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6b7280',
];

function CategoryManagerDialog({ open, onOpenChange, categories, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; categories: Category[]; onSaved: () => void;
}) {
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function resetNew() { setNewName(''); setNewColor(PRESET_COLORS[0]); }
  function startEdit(cat: Category) { setEditingCat(cat); setEditName(cat.name); setEditColor(cat.color); }
  function cancelEdit() { setEditingCat(null); setEditName(''); setEditColor(''); }

  async function createCategory() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      toast.success('Project created');
      resetNew();
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function updateCategory() {
    if (!editingCat || !editName.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/categories/${editingCat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      toast.success('Project updated');
      cancelEdit();
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteCategory(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      toast.success('Project deleted');
      setConfirmDelete(null);
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { cancelEdit(); setConfirmDelete(null); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage projects</DialogTitle>
          <DialogDescription>Create, edit, or delete task projects (categories).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No projects yet. Create one below.</p>
            )}
            {categories.map(cat => (
              <div key={cat.id}>
                {editingCat?.id === cat.id ? (
                  <div className="flex items-center gap-2 rounded-md ring-hairline p-2">
                    <div className="flex gap-1 flex-wrap">
                      {PRESET_COLORS.map(c => (
                        <button key={c} type="button"
                          className={cn('size-5 rounded-full border-2 transition-all', editColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                          style={{ backgroundColor: c }}
                          onClick={() => setEditColor(c)}
                        />
                      ))}
                    </div>
                    <Input value={editName} onChange={e => setEditName(e.target.value)}
                      className="h-7 text-xs flex-1" autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') updateCategory(); if (e.key === 'Escape') cancelEdit(); }}
                    />
                    <Button size="icon" variant="ghost" className="size-7" disabled={busy || !editName.trim()} onClick={updateCategory}>
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={cancelEdit}>
                      <Archive className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md ring-hairline px-3 py-2 group hover:bg-muted/30">
                    <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm flex-1 truncate">{cat.name}</span>
                    {confirmDelete === cat.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" disabled={busy}
                          onClick={() => deleteCategory(cat.id)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                          onClick={() => setConfirmDelete(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => startEdit(cat)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-6 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(cat.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="divider-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">New project</p>
            <div className="flex gap-1 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button"
                  className={cn('size-5 rounded-full border-2 transition-all', newColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Project name" value={newName} onChange={e => setNewName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') createCategory(); }}
              />
              <Button size="sm" className="h-8" disabled={busy || !newName.trim()} onClick={createCategory}>
                <Plus className="size-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Helpers ─── */

function fmtShortDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
