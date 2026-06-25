import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { addDays, fmtDay, fmtHour, startOfWeek } from '@/lib/time-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ManagedUser = { id: string; name: string; email: string; privacy: string };
type Block = { id: string; title: string; startAt: string; endAt: string };

export function ManagerPage() {
  const [people, setPeople] = useState<ManagedUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [blocksError, setBlocksError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ManagedUser[]>('/api/admin/managed-users')
      .then(setPeople)
      .catch(e => setListError((e as Error).message))
      .finally(() => setListLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    // Clear stale state immediately on user switch
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

  const selectedUser = people.find(p => p.id === selected);
  const days = Array.from({ length: 14 }, (_, i) => addDays(startOfWeek(new Date()), i));

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Team</CardTitle>
          <CardDescription>{listLoading ? 'Loading…' : `${people.length} managed users`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {listLoading && (
            <p className="text-xs text-muted-foreground px-1">Loading…</p>
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
                                {fmtHour(new Date(b.startAt))}–{fmtHour(new Date(b.endAt))}
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
