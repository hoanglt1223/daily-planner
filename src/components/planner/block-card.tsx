import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TimeBlock } from './use-planner-data';
import { fmtHour, minutesSinceMidnight, SLOT_MINUTES, WORKDAY_START_HOUR } from '@/lib/time-utils';
import { blockColor } from '@/lib/block-color';
import { cn } from '@/lib/utils';

const PX_PER_SLOT = 28;

export function BlockCard({ block, dayStart, onResize, onClick }: {
  block: TimeBlock;
  dayStart: Date;
  onResize: (id: string, newEndAt: Date) => void;
  onClick: (block: TimeBlock) => void;
}) {
  const start = new Date(block.startAt);
  const end = new Date(block.endAt);
  // TZ-aware: compute pixel position from minutes-since-midnight-Bangkok,
  // not from `start - dayStart` (that depends on browser TZ for midnight).
  void dayStart;
  const startMin = Math.max(0, minutesSinceMidnight(start) - WORKDAY_START_HOUR * 60);
  const durMin = Math.max(SLOT_MINUTES, (end.getTime() - start.getTime()) / 60_000);
  const top = (startMin / SLOT_MINUTES) * PX_PER_SLOT;
  const height = (durMin / SLOT_MINUTES) * PX_PER_SLOT - 2;

  const color = blockColor(block.taskId || block.title || block.id);
  const isPending = block.status === 'pending';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { kind: 'block', block },
  });

  const resizing = useRef<{ startY: number; startEndAt: number; el: HTMLElement | null } | null>(null);

  function onResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation(); e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const card = (e.currentTarget.parentElement as HTMLElement);
    resizing.current = { startY: e.clientY, startEndAt: end.getTime(), el: card };
  }
  function onResizePointerMove(e: React.PointerEvent) {
    if (!resizing.current) return;
    const deltaPx = e.clientY - resizing.current.startY;
    const deltaSlots = Math.round(deltaPx / PX_PER_SLOT);
    const newEnd = resizing.current.startEndAt + deltaSlots * SLOT_MINUTES * 60_000;
    const minEnd = start.getTime() + SLOT_MINUTES * 60_000;
    if (newEnd < minEnd) return;
    if (resizing.current.el) {
      resizing.current.el.style.height =
        `${((newEnd - start.getTime()) / 60_000 / SLOT_MINUTES) * PX_PER_SLOT - 2}px`;
    }
  }
  function onResizePointerUp(e: React.PointerEvent) {
    if (!resizing.current) return;
    const deltaPx = e.clientY - resizing.current.startY;
    const deltaSlots = Math.round(deltaPx / PX_PER_SLOT);
    const newEndTs = resizing.current.startEndAt + deltaSlots * SLOT_MINUTES * 60_000;
    const minEnd = start.getTime() + SLOT_MINUTES * 60_000;
    resizing.current = null;
    if (deltaSlots !== 0 && newEndTs >= minEnd) {
      onResize(block.id, new Date(newEndTs));
    }
  }

  return (
    <div ref={setNodeRef}
      data-block
      {...listeners} {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(block); }}
      style={{
        top, height,
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        'absolute left-1 right-1 z-10 cursor-grab rounded-md border px-1.5 py-1 text-[11px] leading-tight overflow-hidden shadow-sm transition-shadow hover:shadow-md',
        color.bg, color.border, color.fg,
        isPending && 'border-dashed opacity-70',
      )}>
      <div className="flex items-start gap-1">
        <span className={cn('mt-0.5 inline-block size-1.5 shrink-0 rounded-full', color.accent)} />
        <span className="font-medium truncate">{block.title}</span>
      </div>
      <div className="text-[10px] opacity-70">
        {fmtHour(start)}–{fmtHour(end)}
      </div>
      <div
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        className={cn('absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize', color.accent, 'opacity-40 hover:opacity-100')}
      />
    </div>
  );
}

export const BLOCK_PX_PER_SLOT = PX_PER_SLOT;
