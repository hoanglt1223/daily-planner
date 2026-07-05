import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, ListTodo, Loader2, LogOut, Moon, Settings, ShieldCheck, Sun, Users } from 'lucide-react';
import { useTheme } from 'next-themes';
import { apiFetch, clearAuthToken, getAuthToken } from '@/lib/api-client';
import { setActiveTimeZone } from '@/lib/time-utils';
import { useGlobalShortcuts } from '@/lib/use-global-keyboard-shortcuts';
import { useTaskReminders } from '@/hooks/use-task-reminders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { QuickTaskDialog } from '@/components/quick-task-dialog';
import { QuickTimeLogDialog } from '@/components/quick-time-log-dialog';
import { cn } from '@/lib/utils';

type Me = { id: string; name: string; role: 'user' | 'manager' | 'admin'; email: string; timezone?: string };

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  reminderEnabled: boolean;
  reminderMinutes: number | null;
};

const ICONS = {
  '/dashboard': LayoutDashboard,
  '/tasks': ListTodo,
  '/planner': CalendarDays,
  '/manager': Users,
  '/admin': ShieldCheck,
} as const;

export function AppLayout() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const { theme, setTheme } = useTheme();

  useGlobalShortcuts();
  useTaskReminders(tasks);

  useEffect(() => {
    if (!getAuthToken()) { nav('/login', { replace: true }); return; }
    apiFetch<Me>('/api/auth/me')
      .then(data => {
        if (data.timezone) setActiveTimeZone(data.timezone);
        setMe(data);
        setAuthReady(true);
      })
      .catch(() => {
        clearAuthToken();
        nav('/login', { replace: true });
      });
  }, [nav]);

  useEffect(() => {
    if (!authReady) return;
    apiFetch<Task[]>('/api/tasks')
      .then(data => setTasks(data))
      .catch(() => {
        // Silently fail - reminders are optional
      });
  }, [authReady]);

  const links: Array<{ to: keyof typeof ICONS; label: string; show: boolean }> = [
    { to: '/dashboard', label: 'Dashboard', show: true },
    { to: '/tasks', label: 'Tasks', show: true },
    { to: '/planner', label: 'Planner', show: true },
    { to: '/manager', label: 'Manager', show: me?.role === 'manager' || me?.role === 'admin' },
    { to: '/admin', label: 'Admin', show: me?.role === 'admin' },
  ];

  function logout() {
    clearAuthToken();
    nav('/login');
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-muted/20 to-background">
      <header className="sticky top-0 z-30 divider-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xs">
              DP
            </span>
            Daily Planner
          </Link>
          <nav className="flex items-center gap-1">
            {links.filter(l => l.show).map(n => {
              const Icon = ICONS[n.to];
              const active = pathname.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                  )}>
                  <Icon className="size-3.5" /> {n.label}
                </Link>
              );
            })}
            <Button
              variant="ghost" size="icon"
              className="ml-1 size-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {me && (
              <div className="ml-2 flex items-center gap-2 border-l pl-3">
                <div className="text-right">
                  <p className="text-sm leading-tight">{me.name}</p>
                  <Badge variant="secondary" className="text-[9px] py-0">{me.role}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="size-8" asChild title="Settings" aria-label="Settings">
                  <Link to="/settings">
                    <Settings className="size-3.5" />
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={logout} title="Log out" aria-label="Log out">
                  <LogOut className="size-3.5" />
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Suspense fallback={
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        }>
          {authReady && <Outlet />}
        </Suspense>
      </main>
      <KeyboardShortcutsDialog />
      <QuickTaskDialog />
      <QuickTimeLogDialog />
    </div>
  );
}
