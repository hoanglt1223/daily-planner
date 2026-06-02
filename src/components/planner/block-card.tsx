import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TimeBlock } from './use-planner-data';
import { fmtHour, minutesSinceMidnight, SLOT_MINUTES, WORKDAY_START_HOUR } from '@/lib/time-utils';
import { blockColor } from '@/lib/block-color';
import { cn } from '@/lib/utils';

const PX_PER_SLOT = 28;

/** Status cycle for quick-toggle chip */
const STATUS_CYCLE: TimeBlock['status'][] = ['planned', 'in_progress', 'completed', 'skipped'];
const STATUS_LABELS: Record<TimeBlock['status'], string> = {
  planned: 'Planned', in_progress: 'Active', completed: 'Done', skipped: 'Skipped', pending: 'Pending',
};
const STATUS_CHIP_COLORS: Record<TimeBlock['status'], string> = {
  planned: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
  in_progress: 'bg-amber-200 text-amber-800 hover:bg-amber-300',
  completed: 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300',
  skipped: 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300',
  pending: 'bg-blue-200 text-blue-800 hover:bg-blue-300',
};

export function BlockCard({ block, dayStart, onResize, onClick, onStatusChange }: {
  block: TimeBlock;
  dayStart: Date;
  onResize: (id: string, newEndAt: Date) => void;
  onClick: (block: TimeBlock) => void;
  onStatusChange: (id: string, status: TimeBlock['status']) => void;
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
  const isDone = block.status === 'completed' || block.status === 'skipped';
  const [cycling, setCycling] = useState(false);

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    if (cycling) return;
    const idx = STATUS_CYCLE.indexOf(block.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setCycling(true);
    onStatusChange(block.id, next);
    // Reset after brief visual feedback
    setTimeout(() => setCycling(false), 300);
  }

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
        isDone && 'opacity-50',
      )}>
      <div className="flex items-start gap-1">
        <span className={cn('mt-0.5 inline-block size-1.5 shrink-0 rounded-full', color.accent)} />
        <span className={cn('font-medium truncate', block.status === 'completed' && 'line-through')}>{block.title}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-70">
        <span>{fmtHour(start)}–{fmtHour(end)}</span>
        <button
          type="button"
          onClick={cycleStatus}
          className={cn(
            'ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold leading-none transition-colors cursor-pointer select-none',
            STATUS_CHIP_COLORS[block.status],
            cycling && 'animate-pulse',
          )}
          title={`Status: ${STATUS_LABELS[block.status]} → click to cycle`}
        >
          {STATUS_LABELS[block.status]}
        </button>
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
