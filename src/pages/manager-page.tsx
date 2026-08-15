import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { addDays, fmtDay, fmtHour, startOfWeek } from '@/lib/time-utils';
import { fetchTeamCapacity } from '@/lib/capacity-api';
import type { CapacityUser } from '@/lib/capacity-api';
import { CapacityGrid } from '@/components/capacity/capacity-grid';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ManagedUser = { id: string; name: string; email: string; privacy: string };
type Block = { id: string; title: string; startAt: string; endAt: string };
type Me = { role: 'user' | 'manager' | 'admin' };
type View = 'individual' | 'capacity';

export function ManagerPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [people, setPeople] = useState<ManagedUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [view, setView] = useState<View>('individual');

  // Capacity board state
  const [capacityUsers, setCapacityUsers] = useState<CapacityUser[]>([]);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [capacityWeekStart, setCapacityWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  useEffect(() => {
    apiFetch<Me>('/api/auth/me').then(setMe).catch(() => null);
    apiFetch<ManagedUser[]>('/api/admin/managed-users')
      .then(setPeople)
      .catch(e => setListError((e as Error).message))
      .finally(() => setListLoading(false));
  }, []);

  // Individual user blocks
  useEffect(() => {
    if (!selected) return;
    setBlocks([]);
    setBlocksError(null);
    let cancelled = false;
    const from = startOfWeek(new Date());
    const to = addDays(from, 14);
    apiFetch<Block[]>(`/api/time-blocks?viewUser=${selected}&from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(data => { if (!cancelled) setBlocks(data); })
      .catch(e => { if (!cancelled) setBlocksError((e as Error).message); });
    return () => { cancelled = true; };
  }, [selected]);

  // Team capacity board
  useEffect(() => {
    if (view !== 'capacity') return;
    setCapacityLoading(true);
    setCapacityError(null);
    const to = addDays(capacityWeekStart, 7);
    fetchTeamCapacity(capacityWeekStart, to)
      .then(data => setCapacityUsers(data.users))
      .catch(e => setCapacityError((e as Error).message))
      .finally(() => setCapacityLoading(false));
  }, [view, capacityWeekStart]);

  const selectedUser = people.find(p => p.id === selected);
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfWeek(new Date()), i));

  function prevWeek() {
    setCapacityWeekStart(w => addDays(w, -7));
  }
  function nextWeek() {
    setCapacityWeekStart(w => addDays(w, 7));
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={view === 'individual' ? 'default' : 'outline'}
          onClick={() => setView('individual')}
        >
          Individual
        </Button>
        <Button
          size="sm"
          variant={view === 'capacity' ? 'default' : 'outline'}
          onClick={() => setView('capacity')}
        >
          Team capacity
        </Button>
      </div>

      {view === 'individual' && (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Team</CardTitle>
              <CardDescription>
                {listLoading
                  ? 'Loading...'
                  : me?.role === 'admin'
                    ? `${people.length} users (admin)`
                    : `${people.length} managed users`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {listLoading && (
                <p className="text-xs text-muted-foreground px-1">Loading...</p>
              )}
              {!listLoading && listError && (
                <p className="text-xs text-red-600 px-1">{listError}</p>
              )}
              {!listLoading && !listError && people.length === 0 && (
                <p className="text-xs text-muted-foreground">No managed users.</p>
              )}
              {people.map(p => (
                <Button key={p.id} variant={selected === p.id ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelected(p.id)}>
                  <span className="flex flex-col items-start">
                    <span>{p.name}</span>
                    <span className="text-[10px] opacity-70">{shortPrivacy(p.privacy)}</span>
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <section>
            {!selected && (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Pick a user.</CardContent></Card>
            )}
            {selectedUser && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>{selectedUser.name}</CardTitle>
                    <CardDescription>{selectedUser.email}</CardDescription>
                  </div>
                  <Badge variant="secondary">{shortPrivacy(selectedUser.privacy)}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {blocksError && (
                    <p className="text-sm text-red-600">{blocksError}</p>
                  )}
                  {!blocksError && days.map(d => {
                    const day = blocks.filter(b => sameDay(new Date(b.startAt), d));
                    return (
                      <div key={d.toISOString()} className="rounded-md shadow-soft p-2">
                        <p className="text-sm font-medium">{fmtDay(d)}</p>
                        {day.length === 0
                          ? <p className="text-xs text-muted-foreground">Free</p>
                          : <ul className="text-sm">
                              {day.map(b => (
                                <li key={b.id} className="flex justify-between">
                                  <span>{b.title}</span>
                                  <span className="text-muted-foreground">
                                    {fmtHour(new Date(b.startAt))}&ndash;{fmtHour(new Date(b.endAt))}
                                  </span>
                                </li>
                              ))}
                            </ul>}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      )}

      {view === 'capacity' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Team capacity</CardTitle>
              <CardDescription>
                {listLoading
                  ? 'Loading...'
                  : me?.role === 'admin'
                    ? `${people.length} users (admin view)`
                    : `${people.length} managed users`}
              </CardDescription>
            </div>
            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={prevWeek} aria-label="Previous week">
                &lsaquo;
              </Button>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {fmtDay(capacityWeekStart)} &ndash; {fmtDay(addDays(capacityWeekStart, 6))}
              </span>
              <Button size="sm" variant="outline" onClick={nextWeek} aria-label="Next week">
                &rsaquo;
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <CapacityGrid
              users={capacityUsers}
              weekStart={capacityWeekStart}
              loading={capacityLoading}
              error={capacityError}
            />
            <p className="mt-3 text-[10px] text-muted-foreground">
              Capacity baseline: 8h per workday. Green = 50%+ free, amber = 25-50% free, red = under 25% free.
              Users with private visibility are hidden from manager view.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed - shows for both individual and capacity views */}
      <div className="mt-4">
        <ActivityFeed />
      </div>
    </div>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function shortPrivacy(p: string): string {
  if (p === 'details_to_managers') return 'details';
  if (p === 'busy_only_to_managers') return 'busy-only';
  return p;
}
