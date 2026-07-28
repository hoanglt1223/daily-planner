import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtDay, fmtIsoDate, fromWallClock, getActiveTimeZone } from '@/lib/time-utils';
import { formatInTimeZone } from 'date-fns-tz';

export type BlockEditorState =
  | { mode: 'create'; startAt: Date; endAt: Date }
  | { mode: 'edit'; id: string; title: string; startAt: Date; endAt: Date; note: string | null; energyLevel: number | null; recurringRule?: RecurringRule | null };

export type RecurringRule = {
  freq: 'daily' | 'weekly' | 'monthly';
  byDay?: string[];
  interval?: number;
  until?: string;
  defaultTime?: string;
  defaultDurationMinutes?: number;
};

export type TaskOption = { id: string; title: string };

/** Format a Date as "HH:mm" in the active timezone for use in <input type="time"> */
function toTimeInput(d: Date): string {
  return formatInTimeZone(d, getActiveTimeZone(), 'HH:mm');
}

export function BlockEditorDialog({ state, tasks = [], onClose, onCreate, onUpdate, onDelete }: {
  state: BlockEditorState | null;
  tasks?: TaskOption[];
  onClose: () => void;
  onCreate: (data: { title: string; startAt: Date; endAt: Date; note: string; taskId?: string; energyLevel?: number; recurringRule?: RecurringRule | null }) => Promise<void> | void;
  onUpdate: (id: string, data: { title?: string; startAt?: Date; endAt?: Date; note?: string; energyLevel?: number; recurringRule?: RecurringRule | null }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [linkedTaskId, setLinkedTaskId] = useState<string>('');
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recurring rule state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFreq, setRecurFreq] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [recurInterval, setRecurInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>(['MO', 'TU', 'WE', 'TH', 'FR']);
  const [recurUntil, setRecurUntil] = useState<string>('');

  useEffect(() => {
    if (!state) return;
    setTitle(state.mode === 'edit' ? state.title : '');
    setNote(state.mode === 'edit' ? state.note ?? '' : '');
    setStartTime(toTimeInput(state.startAt));
    setDurationMin(Math.max(15, Math.round((state.endAt.getTime() - state.startAt.getTime()) / 60_000)));
    setLinkedTaskId('');
    setEnergyLevel(state.mode === 'edit' ? state.energyLevel ?? null : null);

    // Load recurring rule if editing
    if (state.mode === 'edit' && state.recurringRule) {
      setIsRecurring(true);
      setRecurFreq(state.recurringRule.freq || 'weekly');
      setRecurInterval(state.recurringRule.interval || 1);
      setSelectedDays(state.recurringRule.byDay || ['MO', 'TU', 'WE', 'TH', 'FR']);
      setRecurUntil(state.recurringRule.until || '');
    } else {
      setIsRecurring(false);
      setRecurFreq('weekly');
      setRecurInterval(1);
      setSelectedDays(['MO', 'TU', 'WE', 'TH', 'FR']);
      setRecurUntil('');
    }
  }, [state]);

  if (!state) return null;

  /** Reconstruct startAt/endAt from the editable fields, keeping the original date part. */
  function resolveRange(): { startAt: Date; endAt: Date } {
    const dateIso = fmtIsoDate(state!.startAt);
    const hhmm = startTime || toTimeInput(state!.startAt);
    const resolvedStart = fromWallClock(dateIso, hhmm);
    const resolvedEnd = new Date(resolvedStart.getTime() + durationMin * 60_000);
    return { startAt: resolvedStart, endAt: resolvedEnd };
  }

  /** Build recurring rule object from form state */
  function buildRecurringRule(): RecurringRule | null {
    if (!isRecurring) return null;

    const rule: RecurringRule = {
      freq: recurFreq,
      interval: recurInterval || 1,
      defaultTime: startTime,
      defaultDurationMinutes: durationMin,
    };

    if (recurFreq === 'weekly' && selectedDays.length > 0) {
      rule.byDay = selectedDays;
    }

    if (recurUntil) {
      rule.until = recurUntil;
    }

    return rule;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!state || !title.trim()) return;
    setSubmitting(true);
    try {
      const { startAt, endAt } = resolveRange();
      const recurringRule = buildRecurringRule();
      if (state.mode === 'create') {
        await onCreate({ title: title.trim(), startAt, endAt, note, taskId: linkedTaskId || undefined, energyLevel: energyLevel ?? undefined, recurringRule });
      } else {
        await onUpdate(state.id, { title: title.trim(), startAt, endAt, note, energyLevel: energyLevel ?? undefined, recurringRule });
      }
      onClose();
    } finally { setSubmitting(false); }
  }

  async function remove() {
    if (state?.mode !== 'edit') return;
    setSubmitting(true);
    try { await onDelete(state.id); onClose(); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{state.mode === 'create' ? 'New time block' : 'Edit time block'}</DialogTitle>
            <DialogDescription>
              {fmtDay(state.startAt)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="be-title">Title</Label>
              <Input id="be-title" autoFocus required
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="be-start">Start time</Label>
                <Input
                  id="be-start"
                  type="time"
                  required
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="be-dur">Duration (minutes)</Label>
                <Input
                  id="be-dur"
                  type="number"
                  min={15}
                  step={15}
                  required
                  value={durationMin}
                  onChange={e => setDurationMin(Math.max(15, Number(e.target.value) || 30))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="be-note">Note</Label>
              <Textarea id="be-note" rows={3}
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Energy level (optional)</Label>
              <div className="flex gap-2">
                {[
                  { level: 1, emoji: '😴', label: 'Drained' },
                  { level: 2, emoji: '😐', label: 'Low' },
                  { level: 3, emoji: '🙂', label: 'OK' },
                  { level: 4, emoji: '😃', label: 'Good' },
                  { level: 5, emoji: '⚡', label: 'Peak' },
                ].map(({ level, emoji, label }) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setEnergyLevel(energyLevel === level ? null : level)}
                    className={`flex-1 rounded-md border-2 p-2 text-center transition-all hover:bg-muted ${
                      energyLevel === level
                        ? 'border-primary bg-primary/10'
                        : 'border-muted-foreground/20'
                    }`}
                    title={label}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center gap-2">
                <input
                  id="be-recurring"
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="be-recurring" className="cursor-pointer">Repeat this block</Label>
              </div>

              {isRecurring && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="be-recur-freq">Frequency</Label>
                      <Select value={recurFreq} onValueChange={(v: any) => setRecurFreq(v)}>
                        <SelectTrigger id="be-recur-freq">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="be-recur-interval">Every</Label>
                      <Input
                        id="be-recur-interval"
                        type="number"
                        min={1}
                        value={recurInterval}
                        onChange={e => setRecurInterval(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {recurFreq === 'weekly' && (
                    <div className="space-y-1">
                      <Label>Repeat on</Label>
                      <div className="flex gap-1 flex-wrap">
                        {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (selectedDays.includes(day)) {
                                setSelectedDays(selectedDays.filter(d => d !== day));
                              } else {
                                setSelectedDays([...selectedDays, day]);
                              }
                            }}
                            className={`w-10 h-10 rounded-md text-sm font-medium border transition-all ${
                              selectedDays.includes(day)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/20 hover:bg-muted'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="be-recur-until">Repeat until (optional)</Label>
                    <Input
                      id="be-recur-until"
                      type="date"
                      value={recurUntil}
                      onChange={e => setRecurUntil(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            {state.mode === 'create' && tasks.length > 0 && (
              <div className="space-y-1">
                <Label>Link to task (optional)</Label>
                <Select value={linkedTaskId} onValueChange={setLinkedTaskId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {tasks.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {state.mode === 'edit' ? (
              <Button type="button" variant="ghost" disabled={submitting}
                onClick={remove} className="text-red-600 hover:text-red-700">
                Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting || !title.trim()}>
                {submitting ? '…' : state.mode === 'create' ? 'Create' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
