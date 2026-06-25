/**
 * Public visitor page: reschedule a booking via the rescheduleToken from the email link.
 * Route: /reschedule/:token
 * No auth required.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ArrowRight, CalendarClock, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { setActiveTimeZone } from '@/lib/time-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BookingWrap, BookingLogo, SlotPicker, type Slot } from '@/components/booking/slot-picker';
import {
  getBookingByRescheduleToken,
  getRescheduleSlots,
  rescheduleByToken,
} from '@/lib/booking-api';

type BookingInfo = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  visitorName: string;
  ownerUserId: string;
  eventTypeId: string | null;
};

type PageState =
  | { kind: 'loading' }
  | { kind: 'picking'; booking: BookingInfo; ownerTz: string; slots: Slot[] | null }
  | { kind: 'submitting'; booking: BookingInfo; ownerTz: string; slots: Slot[] | null }
  | { kind: 'success'; newStart: string; newEnd: string; ownerTz: string }
  | { kind: 'already_inactive' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string };

export function RescheduleBookingPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [date, setDate] = useState<Date>(() => new Date());
  const [picked, setPicked] = useState<Slot | null>(null);

  useEffect(() => {
    if (!token) { setState({ kind: 'invalid' }); return; }

    getBookingByRescheduleToken(token)
      .then(bk => {
        if (bk.status === 'cancelled' || bk.status === 'rejected') {
          setState({ kind: 'already_inactive' });
          return;
        }
        // Pre-select the date from the current booking so the visitor sees their slot.
        const currentStart = parseISO(bk.startAt);
        setDate(currentStart);

        setState({ kind: 'picking', booking: bk, ownerTz: 'UTC', slots: null });

        // Fetch slots using the rescheduleToken (no share token needed).
        getRescheduleSlots(token)
          .then(({ owner, slots }) => {
            if (owner.timezone) setActiveTimeZone(owner.timezone);
            setState(prev =>
              prev.kind === 'picking'
                ? { ...prev, ownerTz: owner.timezone, slots }
                : prev
            );
          })
          .catch((e: Error) => {
            toast.error((e as Error).message ?? 'Failed to load available slots.');
            setState(prev =>
              prev.kind === 'picking' ? { ...prev, slots: [] } : prev
            );
          });
      })
      .catch((e: Error) => {
        const msg = e.message ?? '';
        if (msg.includes('410') || msg.includes('booking_inactive')) {
          setState({ kind: 'already_inactive' });
        } else if (msg.includes('404') || msg.includes('not_found')) {
          setState({ kind: 'invalid' });
        } else {
          setState({ kind: 'error', message: msg });
        }
      });
  }, [token]);

  async function handleReschedule() {
    if (!token || !picked || (state.kind !== 'picking')) return;
    const { booking, ownerTz, slots } = state;
    setState({ kind: 'submitting', booking, ownerTz, slots });

    try {
      await rescheduleByToken({
        rescheduleToken: token,
        startAt: picked.startAt,
        endAt: picked.endAt,
      });
      setState({ kind: 'success', newStart: picked.startAt, newEnd: picked.endAt, ownerTz });
    } catch (e: unknown) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('409') || msg.includes('slot_taken')) {
        toast.error('That slot was just taken. Please pick a different time.');
        setState({ kind: 'picking', booking, ownerTz, slots });
        setPicked(null);
      } else if (msg.includes('410') || msg.includes('booking_inactive')) {
        setState({ kind: 'already_inactive' });
      } else {
        setState({ kind: 'error', message: msg });
      }
    }
  }

  if (state.kind === 'loading') {
    return (
      <BookingWrap>
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Loading…</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </BookingWrap>
    );
  }

  if (state.kind === 'invalid') {
    return (
      <BookingWrap>
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <BookingLogo />
            <p className="text-muted-foreground">
              This reschedule link is invalid or has already expired.
            </p>
            <Button asChild size="sm" variant="default">
              <Link to="/">Go to Daily Planner <ArrowRight className="size-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      </BookingWrap>
    );
  }

  if (state.kind === 'already_inactive') {
    return (
      <BookingWrap>
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <BookingLogo />
            <CalendarClock className="size-10 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium">Link no longer active</p>
              <p className="text-sm text-muted-foreground mt-1">
                This booking has been cancelled, declined, or already rescheduled.
                If you need to make a change, please contact the organiser directly.
              </p>
            </div>
          </CardContent>
        </Card>
      </BookingWrap>
    );
  }

  if (state.kind === 'error') {
    return (
      <BookingWrap>
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <BookingLogo />
            <p className="text-muted-foreground">
              Something went wrong. Please try again or contact the organiser.
            </p>
          </CardContent>
        </Card>
      </BookingWrap>
    );
  }

  if (state.kind === 'success') {
    const { newStart, newEnd, ownerTz } = state;
    const tz = ownerTz || 'UTC';
    const startDate = parseISO(newStart);
    const endDate = parseISO(newEnd);
    const dateLabel = formatInTimeZone(startDate, tz, 'EEEE, MMMM d, yyyy');
    const timeLabel = `${formatInTimeZone(startDate, tz, 'HH:mm')} – ${formatInTimeZone(endDate, tz, 'HH:mm')} (${tz})`;

    return (
      <BookingWrap>
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <BookingLogo />
            <CalendarClock className="size-10 text-green-500" aria-hidden />
            <div>
              <p className="font-medium">Booking rescheduled</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your new slot: {dateLabel}, {timeLabel}.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                The organiser has been notified. Check your email for updated reschedule and cancel links.
              </p>
            </div>
          </CardContent>
        </Card>
      </BookingWrap>
    );
  }

  // picking or submitting states.
  const { booking, ownerTz, slots } = state;
  const isSubmitting = state.kind === 'submitting';
  const tz = ownerTz || 'UTC';
  const currentStart = parseISO(booking.startAt);
  const currentEnd = parseISO(booking.endAt);
  const currentDateLabel = formatInTimeZone(currentStart, tz, 'EEEE, MMMM d, yyyy');
  const currentTimeLabel = `${formatInTimeZone(currentStart, tz, 'HH:mm')} – ${formatInTimeZone(currentEnd, tz, 'HH:mm')}`;

  return (
    <BookingWrap>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Reschedule booking</CardTitle>
          <CardDescription>
            {ownerTz
              ? <>Times shown in <span className="font-medium text-foreground">{ownerTz}</span></>
              : 'Pick a new date and time for your meeting.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Current booking</p>
            <p className="font-medium text-sm">{booking.title}</p>
            <p className="text-sm text-muted-foreground">{currentDateLabel}</p>
            <p className="text-sm text-muted-foreground">{currentTimeLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">New date</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  aria-label="Pick a new date"
                  className={cn('w-56 justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={d => { if (d) { setDate(d); setPicked(null); } }}
                  disabled={d =>
                    d < new Date(new Date().setHours(0, 0, 0, 0)) ||
                    d > new Date(Date.now() + 60 * 24 * 60 * 60_000)
                  }
                />
              </PopoverContent>
            </Popover>
          </div>

          <SlotPicker
            slots={slots}
            picked={picked}
            onPick={s => setPicked(s)}
            selectedDate={date}
          />

          {picked && (
            <div className="pt-2 space-y-3">
              <p className="text-sm text-muted-foreground">
                New time: <span className="font-medium text-foreground">
                  {formatInTimeZone(parseISO(picked.startAt), tz, 'HH:mm')} – {formatInTimeZone(parseISO(picked.endAt), tz, 'HH:mm')}
                </span>
              </p>
              <Button
                className="w-full"
                disabled={isSubmitting}
                onClick={handleReschedule}
                aria-label="Confirm reschedule to selected slot"
              >
                {isSubmitting ? 'Rescheduling…' : 'Confirm reschedule'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </BookingWrap>
  );
}
