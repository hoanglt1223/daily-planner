import { useCallback, useMemo, useRef, useState } from 'react';
import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, fmtIsoDate, startOfDay, startOfWeek, WORKDAY_START_HOUR } from '@/lib/time-utils';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TimeColumn } from './time-column';
import { BacklogColumn, type BacklogColumnHandle } from './backlog-column';
import { CapacitySummary } from './capacity-summary';
import { NowLine } from './now-line';
import { BlockEditorDialog, type BlockEditorState } from './block-editor-dialog';
import { usePlannerData, type Task, type TimeBlock } from './use-planner-data';
import { usePlannerShortcuts } from './use-keyboard-shortcuts';

type View = 'day' | 'week';

export function PlannerGrid({ initialView = 'week' as View }) {
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [editor, setEditor] = useState<BlockEditorState | null>(null);
  const backlogRef = useRef<BacklogColumnHandle>(null);

  const days = view === 'week' ? 7 : 1;
  // Memoize range so identity is stable across renders — otherwise
  // usePlannerData's effect fires every render and triggers an infinite loop.
  const rangeStart = useMemo(
    () => view === 'week' ? startOfWeek(anchor) : startOfDay(anchor),
    [view, anchor],
  );
  const rangeEnd = useMemo(() => addDays(rangeStart, days), [rangeStart, days]);
  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, days],
  );

  const { tasks, blocks, categories, loading, createBlock, updateBlock, deleteBlock, createTask, updateTask, deleteTask, createCategory, updateCategory, deleteCategory }
    = usePlannerData(rangeStart, rangeEnd);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const todayIso = fmtIsoDate(new Date());

  const closeEditor = useCallback(() => setEditor(null), []);
  usePlannerShortcuts({
    view, setView, days, setAnchor,
    editorOpen: editor !== null,
    onCloseEditor: closeEditor,
    onNewTask: () => backlogRef.current?.openNewTask(),
    onFocusSearch: () => backlogRef.current?.focusSearch(),
  });

  function blocksForDay(d: Date): TimeBlock[] {
    const isoDay = fmtIsoDate(d);
    return blocks.filter(b => fmtIsoDate(new Date(b.startAt)) === isoDay);
  }

  async function onDragEnd(e: DragEndEvent) {
    const overData = e.over?.data.current as { kind: 'cell'; startAt: Date } | undefined;
    const activeData = e.active.data.current as
      | { kind: 'task'; task: Task }
      | { kind: 'block'; block: TimeBlock }
      | undefined;
    if (!overData || overData.kind !== 'cell' || !activeData) return;

    const cellStart = overData.startAt;
    try {
      if (activeData.kind === 'task') {
        const t = activeData.task;
        await createBlock({
          taskId: t.id, title: t.title,
          startAt: cellStart,
          endAt: new Date(cellStart.getTime() + t.estimatedMinutes * 60_000),
        });
        toast.success(`Scheduled "${t.title}"`);
      } else {
        const b = activeData.block;
        const dur = new Date(b.endAt).getTime() - new Date(b.startAt).getTime();
        await updateBlock(b.id, {
          startAt: cellStart,
          endAt: new Date(cellStart.getTime() + dur),
        });
      }
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup type="single" value={view} variant="outline" size="sm"
            onValueChange={v => v && setView(v as View)}>
            <ToggleGroupItem value="day">Day</ToggleGroupItem>
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setAnchor(addDays(anchor, -days))}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(addDays(anchor, days))}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <CapacitySummary blocks={blocks} days={days} />

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        <div className="flex gap-3">
          <BacklogColumn ref={backlogRef} tasks={tasks} categories={categories}
            onNew={async (title, min, categoryId) => {
              try { await createTask({ title, estimatedMinutes: min, status: 'todo', categoryId }); toast.success('Task added'); }
              catch (e) { toast.error((e as Error).message); }
            }}
            onUpdate={async (id, patch) => {
              try { await updateTask(id, patch); }
              catch (e) { toast.error((e as Error).message); }
            }}
            onDelete={async (id) => {
              try { await deleteTask(id); }
              catch (e) { toast.error((e as Error).message); }
            }}
            onCreateCategory={createCategory}
            onUpdateCategory={updateCategory}
            onDeleteCategory={deleteCategory} />
          <div className="relative flex flex-1 overflow-auto rounded-lg border bg-card shadow-sm">
            <HourRail />
            {dayList.map(d => {
              const dow = d.getDay();
              return (
                <TimeColumn key={d.toISOString()} dayStart={d}
                  blocks={blocksForDay(d)}
                  isToday={fmtIsoDate(d) === todayIso}
                  isWeekend={dow === 0 || dow === 6}
                  onResizeBlock={(id, endAt) => updateBlock(id, { endAt })}
                  onBlockClick={(b) => setEditor({
                    mode: 'edit', id: b.id, title: b.title,
                    startAt: new Date(b.startAt), endAt: new Date(b.endAt), note: b.note,
                  })}
                  onSelectRange={(s, e) => setEditor({ mode: 'create', startAt: s, endAt: e })}
                  onBlockStatusChange={async (id, status) => {
                    try { await updateBlock(id, { status }); }
                    catch (e) { toast.error((e as Error).message); }
                  }}
                />
              );
            })}
            {view === 'day' || dayList.some(d => fmtIsoDate(d) === todayIso)
              ? <NowLine />
              : null}
          </div>
        </div>

        <BlockEditorDialog state={editor}
          onClose={() => setEditor(null)}
          onCreate={async (data) => {
            try { await createBlock(data); toast.success('Block created'); }
            catch (e) { toast.error((e as Error).message); }
          }}
          onUpdate={async (id, data) => {
            try { await updateBlock(id, data); toast.success('Block updated'); }
            catch (e) { toast.error((e as Error).message); }
          }}
          onDelete={async (id) => {
            try { await deleteBlock(id); toast.success('Block deleted'); }
            catch (e) { toast.error((e as Error).message); }
          }}
        />
      </div>
    </DndContext>
  );
}

function HourRail() {
  const slots = (22 - WORKDAY_START_HOUR);
  return (
    <div className="w-14 shrink-0 border-r bg-muted/30 text-[10px] text-muted-foreground">
      <div className="h-7" />
      {Array.from({ length: slots }).map((_, i) => (
        <div key={i} className="h-14 border-b border-dashed pr-2 text-right pt-0.5">
          {String(WORKDAY_START_HOUR + i).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  );
}

