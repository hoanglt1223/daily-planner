import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fmtHour, fmtDay } from '@/lib/time-utils';

export type BlockEditorState =
  | { mode: 'create'; startAt: Date; endAt: Date }
  | { mode: 'edit'; id: string; title: string; startAt: Date; endAt: Date; note: string | null };

export function BlockEditorDialog({ state, onClose, onCreate, onUpdate, onDelete }: {
  state: BlockEditorState | null;
  onClose: () => void;
  onCreate: (data: { title: string; startAt: Date; endAt: Date; note: string }) => Promise<void> | void;
  onUpdate: (id: string, data: { title?: string; startAt?: Date; endAt?: Date; note?: string }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!state) return;
    setTitle(state.mode === 'edit' ? state.title : '');
    setNote(state.mode === 'edit' ? state.note ?? '' : '');
  }, [state]);

  if (!state) return null;
  const dur = Math.round((state.endAt.getTime() - state.startAt.getTime()) / 60_000);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!state || !title.trim()) return;
    setSubmitting(true);
    try {
      if (state.mode === 'create') {
        await onCreate({ title: title.trim(), startAt: state.startAt, endAt: state.endAt, note });
      } else {
        await onUpdate(state.id, { title: title.trim(), note });
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
              {fmtDay(state.startAt)} · {fmtHour(state.startAt)}–{fmtHour(state.endAt)} · {dur} min
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="be-title">Title</Label>
              <Input id="be-title" autoFocus required
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="be-note">Note</Label>
              <Textarea id="be-note" rows={3}
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
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
