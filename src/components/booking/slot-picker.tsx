/**
 * Shared slot-picker UI used by the public booking pages.
 * Displays a 3-column grid of time buttons for the selected date.
 */
import { isSameDay, parseISO } from 'date-fns';
import { fmtHour } from '@/lib/time-utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type Slot = { startAt: string; endAt: string };

interface SlotPickerProps {
  slots: Slot[] | null;
  picked: Slot | null;
  onPick: (s: Slot) => void;
  selectedDate: Date;
}

export function SlotPicker({ slots, picked, onPick, selectedDate }: SlotPickerProps) {
  if (slots === null) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const daySlots = slots.filter(s => isSameDay(parseISO(s.startAt), selectedDate));

  if (daySlots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No free slots on this day. Try another date.</p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {daySlots.map(s => (
        <Button
          key={s.startAt}
          type="button"
          variant={picked?.startAt === s.startAt ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPick(s)}
        >
          {fmtHour(parseISO(s.startAt))}
        </Button>
      ))}
    </div>
  );
}

/** Full-page centering wrapper for public booking pages. */
export function BookingWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}

/** Branded logo mark used in public-facing booking pages. */
export function BookingLogo() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 via-primary to-fuchsia-500 text-white text-xs shadow-sm">
        DP
      </span>
      Daily Planner
    </span>
  );
}
