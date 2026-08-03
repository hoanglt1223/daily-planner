import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle, Target, FolderOpen, CalendarDays, LayoutDashboard, Sparkles, Coffee, BarChart3, Lightbulb, ListTodo, Users, ShieldCheck, Settings, Gauge } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-client';

type Task = { id: string; title: string; status: string; priority: number; dueDate: string | null };
type Habit = { id: string; name: string; frequency: string; targetPerPeriod: number };
type Goal = { id: string; name: string; target: number; current: number; deadline: string | null };
type Project = { id: string; name: string; status: string; color: string };

type ResultItem = {
  id: string;
  type: 'task' | 'habit' | 'goal' | 'project' | 'page';
  title: string;
  subtitle?: string;
  meta?: string;
  icon: React.ElementType;
  path?: string;
  onClick?: () => void;
};

const PAGE_ITEMS: Omit<ResultItem, 'title'>[] = [
  { type: 'page', id: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { type: 'page', id: 'morning-ritual', icon: Coffee, path: '/morning-ritual' },
  { type: 'page', id: 'tasks', icon: ListTodo, path: '/tasks' },
  { type: 'page', id: 'planner', icon: CalendarDays, path: '/planner' },
  { type: 'page', id: 'workload', icon: Gauge, path: '/workload' },
  { type: 'page', id: 'projects', icon: FolderOpen, path: '/projects' },
  { type: 'page', id: 'habits', icon: CheckCircle, path: '/habits' },
  { type: 'page', id: 'goals', icon: Target, path: '/goals' },
  { type: 'page', id: 'weekly-review', icon: BarChart3, path: '/weekly-review' },
  { type: 'page', id: 'insights', icon: Lightbulb, path: '/insights' },
  { type: 'page', id: 'manager', icon: Users, path: '/manager' },
  { type: 'page', id: 'admin', icon: ShieldCheck, path: '/admin' },
  { type: 'page', id: 'settings', icon: Settings, path: '/settings' },
];

const PAGE_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  'morning-ritual': 'Morning Ritual',
  tasks: 'Tasks',
  planner: 'Planner',
  workload: 'Workload',
  projects: 'Projects',
  habits: 'Habits',
  goals: 'Goals',
  'weekly-review': 'Weekly Review',
  insights: 'Insights',
  manager: 'Manager',
  admin: 'Admin',
  settings: 'Settings',
};

export function GlobalCommandPalette() {
  const nav = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const open = useCallback(() => {
    setIsOpen(true);
    setSearch('');
    setResults(PAGE_ITEMS.map(item => ({ ...item, title: PAGE_NAMES[item.id] })));
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch('');
    setResults([]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        const isInputFocused = ['INPUT', 'TEXTAREA'].includes(
          (document.activeElement?.tagName || '')
        );
        if (!isInputFocused && !isOpen) {
          e.preventDefault();
          open();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % results.length);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + results.length) % results.length);
        }
        if (e.key === 'Enter' && results[selectedIndex]) {
          e.preventDefault();
          const item = results[selectedIndex];
          if (item.path) nav(item.path);
          if (item.onClick) item.onClick();
          close();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, nav, open, close]);

  useEffect(() => {
    if (selectedIndex > 0 && itemsRef.current[selectedIndex]) {
      itemsRef.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const query = search.toLowerCase().trim();
    if (!query) {
      setResults(PAGE_ITEMS.map(item => ({ ...item, title: PAGE_NAMES[item.id] })));
      return;
    }

    setLoading(true);
    const abortController = new AbortController();

    Promise.all([
      apiFetch<Task[]>('/api/tasks', { signal: abortController.signal }),
      apiFetch<Habit[]>('/api/habits', { signal: abortController.signal }),
      apiFetch<Goal[]>('/api/goals', { signal: abortController.signal }),
      apiFetch<Project[]>('/api/projects', { signal: abortController.signal }),
    ])
      .then(([tasks, habits, goals, projects]) => {
        const items: ResultItem[] = [];

        tasks
          .filter(t => t.title.toLowerCase().includes(query))
          .slice(0, 5)
          .forEach(t => {
            items.push({
              id: t.id,
              type: 'task',
              title: t.title,
              subtitle: `${t.status} • Priority ${t.priority}`,
              meta: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : undefined,
              icon: CheckCircle,
              path: '/tasks',
              onClick: () => {
                nav('/tasks');
                setTimeout(() => {
                  const taskEl = document.querySelector(`[data-task-id="${t.id}"]`);
                  taskEl?.scrollIntoView({ block: 'center' });
                  taskEl?.classList.add('ring-2', 'ring-primary');
                  setTimeout(() => taskEl?.classList.remove('ring-2', 'ring-primary'), 2000);
                }, 100);
              },
            });
          });

        habits
          .filter(h => h.name.toLowerCase().includes(query))
          .slice(0, 3)
          .forEach(h => {
            items.push({
              id: h.id,
              type: 'habit',
              title: h.name,
              subtitle: `${h.frequency} • ${h.targetPerPeriod}x per period`,
              icon: CheckCircle,
              path: '/habits',
            });
          });

        goals
          .filter(g => g.name.toLowerCase().includes(query))
          .slice(0, 3)
          .forEach(g => {
            items.push({
              id: g.id,
              type: 'goal',
              title: g.name,
              subtitle: `${g.current}/${g.target} ${g.deadline ? `• Due ${new Date(g.deadline).toLocaleDateString()}` : ''}`,
              icon: Target,
              path: '/goals',
            });
          });

        projects
          .filter(p => p.name.toLowerCase().includes(query))
          .slice(0, 3)
          .forEach(p => {
            items.push({
              id: p.id,
              type: 'project',
              title: p.name,
              subtitle: p.status,
              meta: p.color,
              icon: FolderOpen,
              path: '/projects',
            });
          });

        PAGE_ITEMS.filter(p => PAGE_NAMES[p.id].toLowerCase().includes(query))
          .forEach(p => {
            items.push({ ...p, title: PAGE_NAMES[p.id] });
          });

        setResults(items);
        setSelectedIndex(0);
      })
      .catch(() => {
        setResults(PAGE_ITEMS.filter(p => PAGE_NAMES[p.id].toLowerCase().includes(query))
          .map(p => ({ ...p, title: PAGE_NAMES[p.id] })));
      })
      .finally(() => {
        setLoading(false);
      });

    return () => abortController.abort();
  }, [search, isOpen, nav]);

  const groupedResults = results.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, ResultItem[]>);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-2xl p-0" onKeyDown={handleKeyDown}>
        <div className="flex items-center border-b px-4 py-3">
          <Search className="size-5 text-muted-foreground mr-3" />
          <Input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks, habits, goals, projects, or pages... (Press / to open)"
            className="border-0 focus-visible:ring-0 text-base"
          />
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="size-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No results found</p>
              <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedResults).map(([type, items]) => (
                <div key={type} className="space-y-1">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                    {type === 'page' ? 'Pages' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                  </div>
                  {items.map((item) => {
                    const globalIndex = results.indexOf(item);
                    const Icon = item.icon;
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        ref={el => {
                          if (itemsRef.current) {
                            itemsRef.current[globalIndex] = el;
                          }
                        }}
                        onClick={() => {
                          if (item.path) nav(item.path);
                          if (item.onClick) item.onClick();
                          close();
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.title}</div>
                          {item.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                          )}
                        </div>
                        {item.meta && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {item.meta}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>Press / to open</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
