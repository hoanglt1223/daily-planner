import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { addDays, fmtDay, fmtHour, startOfWeek } from '@/lib/time-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type ShareData = {
  user: { name: string; timezone: string };
  privacy: 'details_to_managers' | 'busy_only_to_managers' | 'private';
  blocks: Array<{ id: string; title: string; startAt: string; endAt: string }>;
};

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 via-primary to-fuchsia-500 text-white text-xs shadow-sm">
        DP
      </span>
      Daily Planner
    </span>
  );
}

export function ShareViewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then(setData)
      .catch(e => setError(e.message));
  }, [token]);

  if (error) return (
    <Wrap>
      <Card className="shadow-soft">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Logo />
          <p className="text-muted-foreground">
            {error === '404' ? 'This share link is private or invalid.' : `Something went wrong (${error}).`}
          </p>
          <Button asChild size="sm">
            <Link to="/">Go to Daily Planner <ArrowRight className="size-3.5" /></Link>
          </Button>
        </CardContent>
      </Card>
    </Wrap>
  );

  if (!data) return (
    <Wrap>
      <Card className="shadow-soft">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-muted-foreground">Loading shared schedule…</p>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    </Wrap>
  );

  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 21 }, (_, i) => addDays(weekStart, i));
  const busyOnly = data.privacy === 'busy_only_to_managers';

  return (
    <Wrap>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{data.user.name}'s schedule</CardTitle>
            <CardDescription>Read-only · next 3 weeks · {data.user.timezone}</CardDescription>
          </div>
          {busyOnly && <Badge variant="secondary">busy-only</Badge>}
        </CardHeader>
        <CardContent className="space-y-2">
          {days.map(d => {
            const dayBlocks = data.blocks.filter(b => sameDay(new Date(b.startAt), d));
            return (
              <div key={d.toISOString()} className="rounded-md shadow-soft p-3">
                <p className="text-sm font-medium">{fmtDay(d)}</p>
                {dayBlocks.length === 0
                  ? <p className="text-xs text-muted-foreground">Free</p>
                  : <ul className="mt-1 space-y-1 text-sm">
                      {dayBlocks.map(b => (
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
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
