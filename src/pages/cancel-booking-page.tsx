/**
 * Public visitor page: cancel a booking via the cancelToken from the email link.
 * Route: /cancel/:token
 * No auth required.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ArrowRight, CalendarX2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookingWrap, BookingLogo } from '@/components/booking/slot-picker';
import { getBookingByCancelToken, cancelByToken } from '@/lib/booking-api';

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
  | { kind: 'ready'; booking: BookingInfo; ownerTz: string }
  | { kind: 'confirming'; booking: BookingInfo; ownerTz: string }
  | { kind: 'cancelled' }
  | { kind: 'already_inactive' }
  | { kind: 'invalid' }
  | { kind: 'error'; message: string };

export function CancelBookingPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    if (!token) { setState({ kind: 'invalid' }); return; }

    getBookingByCancelToken(token)
      .then(bk => {
        // The API returns 410 for inactive bookings and apiFetch throws with that status.
        // On success we get the booking; detect already-cancelled status here as well.
        if (bk.status === 'cancelled' || bk.status === 'rejected') {
          setState({ kind: 'already_inactive' });
          return;
        }
        // We don't receive ownerTz from this endpoint; default to UTC and re-use UTC display.
        setState({ kind: 'ready', booking: bk, ownerTz: 'UTC' });
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

  async function handleCancel() {
    if (!token || state.kind !== 'ready') return;
    setState({ kind: 'confirming', booking: state.booking, ownerTz: state.ownerTz });

    try {
      await cancelByToken(token);
      setState({ kind: 'cancelled' });
    } catch (e: unknown) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('410') || msg.includes('booking_inactive')) {
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
              This cancel link is invalid or has already expired.
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
            <CalendarX2 className="size-10 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium">Already cancelled</p>
              <p className="text-sm text-muted-foreground mt-1">
                This booking has already been cancelled or declined.
              </p>
            </div>
          </CardContent>
        </Card>
      </BookingWrap>
    );
  }

  if (state.kind === 'cancelled') {
    return (
      <BookingWrap>
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <BookingLogo />
            <CalendarX2 className="size-10 text-green-500" aria-hidden />
            <div>
              <p className="font-medium">Booking cancelled</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your booking has been cancelled. The organiser has been notified.
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

  // ready or confirming states share the same layout.
  const { booking, ownerTz } = state;
  const isConfirming = state.kind === 'confirming';
  const startDate = parseISO(booking.startAt);
  const endDate = parseISO(booking.endAt);
  const tz = ownerTz || 'UTC';
  const dateLabel = formatInTimeZone(startDate, tz, 'EEEE, MMMM d, yyyy');
  const timeLabel = `${formatInTimeZone(startDate, tz, 'HH:mm')} – ${formatInTimeZone(endDate, tz, 'HH:mm')} (${tz})`;

  return (
    <BookingWrap>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Cancel booking</CardTitle>
          <CardDescription>
            Review your booking details before confirming the cancellation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1">
            <p className="font-medium text-sm">{booking.title}</p>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
            <p className="text-sm text-muted-foreground">{timeLabel}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            Cancelling will notify the organiser and remove this time slot.
            This action cannot be undone.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="destructive"
              disabled={isConfirming}
              onClick={handleCancel}
              aria-label="Confirm booking cancellation"
            >
              {isConfirming ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </BookingWrap>
  );
}
