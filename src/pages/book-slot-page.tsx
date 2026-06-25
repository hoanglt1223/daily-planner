import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarIcon, ArrowRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { setActiveTimeZone } from '@/lib/time-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getPublicEventTypes, getSlotsV2, type PublicEventType } from '@/lib/booking-api';
import { SlotPicker, BookingWrap, BookingLogo, type Slot } from '@/components/booking/slot-picker';

type Owner = { name: string; timezone: string };

export function BookSlotPage() {
  const { token } = useParams<{ token: string }>();

  // Step 1: pick event type
  const [eventTypes, setEventTypes] = useState<PublicEventType[] | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<PublicEventType | null>(null);

  // Step 2: pick slot
  const [date, setDate] = useState<Date>(() => new Date());
  const [owner, setOwner] = useState<Owner | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);

  // Step 3: confirm form
  const [submitted, setSubmitted] = useState(false);
  const [submittedTokens, setSubmittedTokens] = useState<{ rescheduleToken: string; cancelToken: string } | null>(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [form, setForm] = useState({ visitorName: '', visitorEmail: '', title: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  // Load event types on mount.
  useEffect(() => {
    if (!token) return;
    getPublicEventTypes(token)
      .then(data => {
        if (data.owner?.timezone) setActiveTimeZone(data.owner.timezone);
        setOwner(data.owner);
        setEventTypes(data.eventTypes);
        // If only one event type, auto-select it.
        if (data.eventTypes.length === 1) setSelectedEventType(data.eventTypes[0]);
      })
      .catch(e => {
        const msg = (e as Error).message;
        if (msg.includes('404') || msg.includes('Not found')) setInvalidToken(true);
        else { setFetchError(msg); }
      });
  }, [token]);

  // Load slots when event type selected.
  useEffect(() => {
    if (!token || !selectedEventType) return;
    setSlots(null); setPicked(null); setFetchError(null);
    getSlotsV2(token, selectedEventType.id)
      .then(data => {
        if (data.owner?.timezone) setActiveTimeZone(data.owner.timezone);
        setOwner(data.owner);
        setSlots(data.slots);
      })
      .catch(e => {
        // Fallback: try legacy free-slots if the new endpoint fails.
        const msg = (e as Error).message;
        setFetchError(msg);
        toast.error(msg);
      });
  }, [token, selectedEventType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked || !token) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, ...form,
          startAt: picked.startAt, endAt: picked.endAt,
          eventTypeId: selectedEventType?.id ?? undefined,
        }),
      });
      if (!r.ok) {
        const msg = r.status === 409
          ? 'Slot just got taken. Please pick another.'
          : r.status === 429
            ? 'Too many requests. Please wait 30 seconds.'
            : await r.text();
        throw new Error(msg);
      }
      const data = await r.json() as { id: string; status: string; rescheduleToken?: string; cancelToken?: string };
      if (data.rescheduleToken && data.cancelToken) {
        setSubmittedTokens({ rescheduleToken: data.rescheduleToken, cancelToken: data.cancelToken });
      }
      setSubmitted(true);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }

  // Error / invalid token states.
  if (invalidToken) return (
    <BookingWrap>
      <Card className="shadow-soft">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <BookingLogo />
          <p className="text-muted-foreground">This booking link is invalid or has expired.</p>
          <Button asChild size="sm" variant="default">
            <Link to="/">Go to Daily Planner <ArrowRight className="size-3.5" /></Link>
          </Button>
        </CardContent>
      </Card>
    </BookingWrap>
  );

  if (fetchError) return (
    <BookingWrap>
      <Card className="shadow-soft">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <BookingLogo />
          <p className="text-muted-foreground">Something went wrong loading this page. Please try again later.</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Go to Daily Planner <ArrowRight className="size-3.5" /></Link>
          </Button>
        </CardContent>
      </Card>
    </BookingWrap>
  );

  if (submitted) return (
    <BookingWrap>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Request sent</CardTitle>
          <CardDescription>{owner?.name} will review and confirm your request.</CardDescription>
        </CardHeader>
        {submittedTokens && (
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>Changed your plans? Use the links in your confirmation email to reschedule or cancel.</p>
          </CardContent>
        )}
      </Card>
    </BookingWrap>
  );

  // Step 1: choose event type (if more than one).
  if (eventTypes === null) {
    return (
      <BookingWrap>
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Loading…</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </CardContent>
        </Card>
      </BookingWrap>
    );
  }

  if (!selectedEventType) {
    return (
      <BookingWrap>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Book a slot with {owner?.name ?? '…'}</CardTitle>
            <CardDescription>Choose the type of meeting you would like to schedule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {eventTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">This person has not set up any booking types yet.</p>
            ) : (
              eventTypes.map(et => (
                <button
                  key={et.id}
                  onClick={() => setSelectedEventType(et)}
                  className="w-full text-left rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{et.name}</p>
                    <Badge variant="secondary" className="shrink-0">
                      <Clock className="size-3 mr-1" />{et.durationMinutes} min
                    </Badge>
                  </div>
                  {et.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{et.description}</p>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </BookingWrap>
    );
  }

  // Step 2 + 3: pick date/slot and confirm.
  return (
    <BookingWrap>
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Book a slot with {owner?.name ?? '…'}</CardTitle>
              <CardDescription>
                {owner?.timezone
                  ? <>Times shown in <span className="font-medium text-foreground">{owner.timezone}</span></>
                  : 'Loading…'}
              </CardDescription>
            </div>
            {eventTypes.length > 1 && (
              <Button
                size="sm" variant="outline"
                onClick={() => { setSelectedEventType(null); setSlots(null); setPicked(null); }}
                className="shrink-0 text-xs"
              >
                Change type
              </Button>
            )}
          </div>
          <div className="mt-1">
            <Badge variant="secondary">
              <Clock className="size-3 mr-1" />{selectedEventType.name} · {selectedEventType.durationMinutes} min
            </Badge>
          </div>
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

          <SlotPicker slots={slots} picked={picked} onPick={setPicked} selectedDate={date} />

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
    </BookingWrap>
  );
}


