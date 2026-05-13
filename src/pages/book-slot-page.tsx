import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { fmtDay, fmtHour, fmtIsoDate } from '@/lib/time-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Slot = { startAt: string; endAt: string };
type Owner = { name: string; timezone: string };

export function BookSlotPage() {
  const { token } = useParams<{ token: string }>();
  const [date, setDate] = useState<Date>(() => new Date());
  const [owner, setOwner] = useState<Owner | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ visitorName: '', visitorEmail: '', title: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    setSlots(null); setPicked(null);
    const iso = fmtIsoDate(date);
    fetch(`/api/bookings/free-slots?token=${token}&date=${iso}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
      .then(d => { setOwner(d.owner); setSlots(d.slots); })
      .catch(e => toast.error(e.message));
  }, [token, date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || !token) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form, startAt: picked.startAt, endAt: picked.endAt }),
      });
      if (!r.ok) {
        const msg = r.status === 409
          ? 'Slot just got taken — pick another.'
          : r.status === 429
            ? 'Too many requests. Please wait 30 seconds.'
            : await r.text();
        throw new Error(msg);
      }
      setSubmitted(true);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }

  if (submitted) return (
    <Wrap>
      <Card>
        <CardHeader>
          <CardTitle>Request sent</CardTitle>
          <CardDescription>{owner?.name} will review and confirm.</CardDescription>
        </CardHeader>
      </Card>
    </Wrap>
  );

  return (
    <Wrap>
      <Card>
        <CardHeader>
          <CardTitle>Book a slot with {owner?.name ?? '…'}</CardTitle>
          <CardDescription>Timezone: {owner?.timezone ?? '…'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant="outline"
                  className={cn('w-56 justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                  <CalendarIcon />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date}
                  onSelect={d => d && setDate(d)}
                  disabled={d => d < new Date(new Date().setHours(0, 0, 0, 0)) ||
                    d > new Date(Date.now() + 60 * 24 * 60 * 60_000)} />
              </PopoverContent>
            </Popover>
          </div>

          <SlotPicker slots={slots} picked={picked} onPick={setPicked} />

          {picked && (
            <form onSubmit={submit} className="flex flex-col gap-3 pt-2">
              <div className="space-y-1">
                <Label htmlFor="visitorName">Your name</Label>
                <Input id="visitorName" required
                  value={form.visitorName} onChange={e => setForm({ ...form, visitorName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="visitorEmail">Your email</Label>
                <Input id="visitorEmail" type="email" required
                  value={form.visitorEmail} onChange={e => setForm({ ...form, visitorEmail: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="title">Meeting title</Label>
                <Input id="title" required
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea id="note"
                  value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Request booking'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Wrap>
  );
}

function SlotPicker({ slots, picked, onPick }: {
  slots: Slot[] | null; picked: Slot | null; onPick: (s: Slot) => void;
}) {
  if (slots === null) return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  );
  if (slots.length === 0) return (
    <p className="text-sm text-muted-foreground">No free slots in next 14 days from this date.</p>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map(s => (
        <Button key={s.startAt} type="button"
          variant={picked?.startAt === s.startAt ? 'default' : 'outline'}
          size="sm" onClick={() => onPick(s)}>
          {fmtDay(parseISO(s.startAt))} {fmtHour(parseISO(s.startAt))}
        </Button>
      ))}
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 py-8">{children}</div>;
}
