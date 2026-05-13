import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { addMinutes, fmtDay, fmtIsoDate, SLOT_MINUTES, WORKDAY_END_HOUR, WORKDAY_START_HOUR } from '@/lib/time-utils';
import { BlockCard, BLOCK_PX_PER_SLOT } from './block-card';
import type { TimeBlock } from './use-planner-data';
import { cn } from '@/lib/utils';

type SelectRange = { start: Date; end: Date };

export function TimeColumn({ dayStart, blocks, isToday, isWeekend, onResizeBlock, onBlockClick, onSelectRange }: {
  dayStart: Date;
  blocks: TimeBlock[];
  isToday: boolean;
  isWeekend: boolean;
  onResizeBlock: (id: string, newEndAt: Date) => void;
  onBlockClick: (b: TimeBlock) => void;
  onSelectRange: (startAt: Date, endAt: Date) => void;
}) {
  const slots = ((WORKDAY_END_HOUR - WORKDAY_START_HOUR) * 60) / SLOT_MINUTES;
  const dayIso = fmtIsoDate(dayStart);
  const [selecting, setSelecting] = useState<SelectRange | null>(null);

  function pointerDown(e: React.PointerEvent<HTMLDivElement>, cellStart: Date) {
    const target = e.target as HTMLElement;
    if (target.closest('[data-block]')) return;
    e.preventDefault();

    let endStart = cellStart;
    setSelecting({ start: cellStart, end: cellStart });

    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const cell = el?.closest('[data-cell-iso]') as HTMLElement | null;
      if (!cell) return;
      const iso = cell.getAttribute('data-cell-iso');
      const col = cell.getAttribute('data-col');
      if (!iso || col !== dayIso) return;
      endStart = new Date(iso);
      setSelecting({ start: cellStart, end: endStart });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      setSelecting(null);
      const a = cellStart.getTime();
      const b = endStart.getTime();
      const lo = Math.min(a, b);
      const hi = Math.max(a, b) + SLOT_MINUTES * 60_000;
      onSelectRange(new Date(lo), new Date(hi));
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  // Pixel band for the live selection overlay (rendered absolutely over cells).
  const overlay = (() => {
    if (!selecting) return null;
    const lo = Math.min(selecting.start.getTime(), selecting.end.getTime());
    const hi = Math.max(selecting.start.getTime(), selecting.end.getTime()) + SLOT_MINUTES * 60_000;
    const dayStartMs = dayStart.getTime() + WORKDAY_START_HOUR * 60 * 60_000;
    const topMin = Math.max(0, (lo - dayStartMs) / 60_000);
    const heightMin = Math.max(SLOT_MINUTES, (hi - lo) / 60_000);
    return {
      top: (topMin / SLOT_MINUTES) * BLOCK_PX_PER_SLOT,
      height: (heightMin / SLOT_MINUTES) * BLOCK_PX_PER_SLOT,
    };
  })();

  return (
    <div data-col={dayIso}
      className={cn('flex-1 min-w-32 border-r last:border-r-0',
        isWeekend && 'bg-muted/30',
      )}>
      <div className={cn(
        'sticky top-0 z-10 border-b bg-background/90 backdrop-blur px-2 py-1.5 text-center text-xs font-medium',
        isToday && 'text-primary',
      )}>
        {fmtDay(dayStart)}
        {isToday && <span className="ml-1 inline-block size-1.5 rounded-full bg-primary align-middle" />}
      </div>
      <div className="relative">
        {Array.from({ length: slots }).map((_, i) => {
          const cellStart = addMinutes(addMinutes(dayStart, WORKDAY_START_HOUR * 60), i * SLOT_MINUTES);
          const isHour = i % 2 === 0;
          return (
            <div key={i}
              data-cell-iso={cellStart.toISOString()}
              data-col={dayIso}
              onPointerDown={(e) => pointerDown(e, cellStart)}
              style={{ height: BLOCK_PX_PER_SLOT }}
              className={cn(
                'border-b cursor-pointer hover:bg-primary/5 transition-colors',
                isHour ? 'border-border' : 'border-dashed border-muted',
              )}>
              <DroppableTarget startAt={cellStart} />
            </div>
          );
        })}

        {overlay && (
          <div
            className="pointer-events-none absolute inset-x-1 z-10 rounded-md border-2 border-primary/70 bg-primary/15 shadow-sm"
            style={{ top: overlay.top, height: overlay.height - 2 }}>
            <div className="m-1 text-[10px] font-medium text-primary">
              {fmtRange(selecting!.start, selecting!.end)}
            </div>
          </div>
        )}

        {blocks.map(b => (
          <div key={b.id} data-block className="absolute inset-x-0">
            <BlockCard block={b} dayStart={dayStart}
              onResize={onResizeBlock} onClick={onBlockClick} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DroppableTarget({ startAt }: { startAt: Date }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${startAt.toISOString()}`,
    data: { kind: 'cell', startAt },
  });
  return <div ref={setNodeRef} className={cn('h-full', isOver && 'bg-primary/15')} />;
}

function fmtRange(a: Date, b: Date): string {
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  const hiEnd = new Date(hi.getTime() + SLOT_MINUTES * 60_000);
  const dur = Math.round((hiEnd.getTime() - lo.getTime()) / 60_000);
  const h = Math.floor(dur / 60); const m = dur % 60;
  const durStr = h ? (m ? `${h}h${m}m` : `${h}h`) : `${m}m`;
  return `${fmtHHmm(lo)}–${fmtHHmm(hiEnd)} · ${durStr}`;
}
function fmtHHmm(d: Date): string {
  return d.toTimeString().slice(0, 5);
}
