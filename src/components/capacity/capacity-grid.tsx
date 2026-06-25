import { cn } from '@/lib/utils';
import { fmtDay, addDays } from '@/lib/time-utils';
import type { CapacityUser } from '@/lib/capacity-api';
import { Skeleton } from '@/components/ui/skeleton';

const WORKDAY_MINUTES = 8 * 60;

// Returns a tone string based on free capacity fraction
function freeTone(freeMinutes: number): string {
  const pct = freeMinutes / WORKDAY_MINUTES;
  if (pct >= 0.5) return 'emerald';
  if (pct >= 0.25) return 'amber';
  return 'red';
}

function barBg(tone: string) {
  if (tone === 'emerald') return 'bg-emerald-500';
  if (tone === 'amber') return 'bg-amber-400';
  return 'bg-red-400';
}

function cellBg(tone: string) {
  if (tone === 'emerald') return 'bg-emerald-50 dark:bg-emerald-950/30';
  if (tone === 'amber') return 'bg-amber-50 dark:bg-amber-950/30';
  return 'bg-red-50 dark:bg-red-950/30';
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}

function shortPrivacy(p: string): string {
  if (p === 'details_to_managers') return 'details';
  if (p === 'busy_only_to_managers') return 'busy-only';
  return p;
}

interface Props {
  users: CapacityUser[];
  weekStart: Date;
  loading: boolean;
  error: string | null;
}

export function CapacityGrid({ users, weekStart, loading, error }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  if (error) {
    return (
      <p className="text-sm text-red-600 px-1">{error}</p>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1">No team members to display.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-0">
        <thead>
          <tr>
            {/* User column header */}
            <th className="sticky left-0 z-10 bg-background text-left font-medium text-muted-foreground px-3 py-2 min-w-[140px] border-b">
              Member
            </th>
            {days.map(d => (
              <th
                key={d.toISOString()}
                className="text-center font-medium text-muted-foreground px-2 py-2 min-w-[88px] border-b whitespace-nowrap"
              >
                {fmtDay(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, uIdx) => (
            <tr key={u.userId} className={uIdx % 2 === 0 ? '' : 'bg-muted/30'}>
              <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-b">
                <p className="font-medium leading-tight truncate max-w-[130px]">{u.name}</p>
                <p className="text-[10px] text-muted-foreground">{shortPrivacy(u.privacy)}</p>
              </td>
              {u.days.map(day => {
                const tone = freeTone(day.freeMinutes);
                const loadPct = Math.round(
                  (day.bookedMinutes / WORKDAY_MINUTES) * 100,
                );
                return (
                  <td
                    key={day.date}
                    className={cn('px-2 py-1.5 border-b align-top', cellBg(tone))}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between gap-1 leading-tight">
                        <span className="text-muted-foreground">free</span>
                        <span className="font-medium tabular-nums">
                          {fmtHm(day.freeMinutes)}
                        </span>
                      </div>
                      {/* Load bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full transition-all', barBg(tone))}
                          style={{ width: `${loadPct}%` }}
                          title={`${loadPct}% booked`}
                        />
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
