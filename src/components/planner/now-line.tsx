import { useEffect, useState } from 'react';
import { WORKDAY_START_HOUR, SLOT_MINUTES } from '@/lib/time-utils';
import { BLOCK_PX_PER_SLOT } from './block-card';

const HEADER_OFFSET_PX = 28;

/**
 * Horizontal red line indicating "now" within the planner grid.
 * Re-renders every minute. Renders nothing if outside the working-hours window.
 */
export function NowLine() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < WORKDAY_START_HOUR || hour >= 22) return null;
  const top = HEADER_OFFSET_PX + ((hour - WORKDAY_START_HOUR) * 60) / SLOT_MINUTES * BLOCK_PX_PER_SLOT;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top }}>
      <div className="flex items-center">
        <div className="size-2 rounded-full bg-red-500 -ml-1" />
        <div className="h-px flex-1 bg-red-500" />
      </div>
    </div>
  );
}
