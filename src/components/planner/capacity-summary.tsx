import type { TimeBlock } from './use-planner-data';
import { WORKDAY_HOURS } from '@/lib/time-utils';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function CapacitySummary({ blocks, days }: { blocks: TimeBlock[]; days: number }) {
  const workMinPerDay = WORKDAY_HOURS * 60;
  const total = workMinPerDay * days;
  const booked = blocks.reduce((s, b) =>
    s + Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000), 0);
  const free = Math.max(0, total - booked);
  const pct = Math.round((free / total) * 100);
  const tone = pct < 25 ? 'red' : pct < 50 ? 'amber' : 'emerald';

  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        <Stat label="Booked" value={fmtHm(booked)} tone="slate" />
        <Stat label="Free" value={fmtHm(free)} tone={tone} />
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Load · {100 - pct}%</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full transition-all', toneBar(tone))}
              style={{ width: `${100 - pct}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-semibold tracking-tight', toneText(tone))}>{value}</p>
    </div>
  );
}

function toneText(t: string) {
  return t === 'red' ? 'text-red-600' : t === 'amber' ? 'text-amber-600' : t === 'emerald' ? 'text-emerald-600' : '';
}
function toneBar(t: string) {
  return t === 'red' ? 'bg-red-500' : t === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
}

function fmtHm(min: number) {
  const h = Math.floor(min / 60); const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}
