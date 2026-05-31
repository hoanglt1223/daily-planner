import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import { apiFetch, clearAuthToken, getAuthToken } from '@/lib/api-client';
import { useGlobalShortcuts } from '@/lib/use-global-keyboard-shortcuts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
import { cn } from '@/lib/utils';

type Me = { id: string; name: string; role: 'user' | 'manager' | 'admin'; email: string };

const ICONS = {
  '/dashboard': LayoutDashboard,
  '/planner': CalendarDays,
  '/manager': Users,
  '/admin': ShieldCheck,
} as const;

export function AppLayout() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [me, setMe] = useState<Me | null>(null);

  useGlobalShortcuts();

  useEffect(() => {
    if (!getAuthToken()) { nav('/login'); return; }
    apiFetch<Me>('/api/auth/me').then(setMe).catch(() => {
      clearAuthToken();
      nav('/login');
    });
  }, [nav]);

  const links: Array<{ to: keyof typeof ICONS; label: string; show: boolean }> = [
    { to: '/dashboard', label: 'Dashboard', show: true },
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
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
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
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                    active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
                  )}>
                  <Icon className="size-3.5" /> {n.label}
                </Link>
              );
            })}
            {me && (
              <div className="ml-2 flex items-center gap-2 border-l pl-3">
                <div className="text-right">
                  <p className="text-sm leading-tight">{me.name}</p>
                  <Badge variant="secondary" className="text-[9px] py-0">{me.role}</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="size-3.5" />
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <KeyboardShortcutsDialog />
    </div>
  );
}
