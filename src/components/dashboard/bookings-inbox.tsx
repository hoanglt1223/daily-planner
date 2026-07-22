import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fmtDay, fmtHour } from '@/lib/time-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingCostBadge } from '@/components/meeting-cost-badge';

type Booking = {
  id: string; visitorName: string; visitorEmail: string;
  title: string; note: string | null;
  startAt: string; endAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  calculatedCost: number | null;
};

export function BookingsInbox() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  // Track busy state per booking id to prevent duplicate POSTs
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    apiFetch<Booking[]>('/api/bookings?action=mine')
      .then(setBookings)
      .catch(e => toast.error((e as Error).message));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, action: 'approve' | 'reject') {
    if (busyIds.has(id)) return;
    setBusyIds(prev => new Set(prev).add(id));
    try {
      await apiFetch(`/api/bookings/${action}/${id}`, { method: 'POST' });
      toast.success(action === 'approve' ? 'Booking approved' : 'Booking rejected');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  const pending = bookings?.filter(b => b.status === 'pending') ?? [];
  const recent = bookings?.filter(b => b.status !== 'pending').slice(0, 5) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Booking requests</CardTitle>
          <CardDescription>External visitors asking for slots.</CardDescription>
        </div>
        <Badge variant={pending.length ? 'default' : 'secondary'}>{pending.length} pending</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {bookings === null ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map(b => {
              const busy = busyIds.has(b.id);
              const duration = Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000);
              return (
                <li key={b.id} className="rounded-md ring-hairline p-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDay(new Date(b.startAt))} {fmtHour(new Date(b.startAt))}–{fmtHour(new Date(b.endAt))}
                      </p>
                      <p className="text-xs">From {b.visitorName} &lt;{b.visitorEmail}&gt;</p>
                      {b.note && <p className="mt-1 text-xs italic text-muted-foreground">"{b.note}"</p>}
                    </div>
                    <MeetingCostBadge cost={b.calculatedCost} duration={duration} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => act(b.id, 'approve')}>
                      {busy ? 'Saving…' : 'Approve'}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(b.id, 'reject')}>
                      Reject
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {recent.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                Recent ({recent.length})
                <ChevronDown className="size-3 transition-transform data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-1 space-y-1 text-xs">
                {recent.map(b => {
                  const duration = Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000);
                  return (
                    <li key={b.id} className="flex items-center justify-between gap-2 px-2 py-1">
                      <div className="flex-1 truncate">
                        <span className="truncate">{b.title}</span>
                        <span className="text-muted-foreground"> — {b.visitorName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MeetingCostBadge cost={b.calculatedCost} duration={duration} />
                        <Badge variant={b.status === 'approved' ? 'default' : 'secondary'} className="text-xs">{b.status}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
