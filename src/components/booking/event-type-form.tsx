import { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { BookingEventType } from '@/lib/booking-api';
import { createEventType, updateEventType } from '@/lib/booking-api';

interface Props {
  /** Omit to create a new event type. */
  existing?: BookingEventType;
  onSaved: (et: BookingEventType) => void;
  onCancel: () => void;
}

export function EventTypeForm({ existing, onSaved, onCancel }: Props) {
  const [name, setName] = useState(existing?.name ?? '');
  const [durationMinutes, setDurationMinutes] = useState(String(existing?.durationMinutes ?? 30));
  const [description, setDescription] = useState(existing?.description ?? '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    const dur = Number(durationMinutes);
    if (!name.trim()) { toast.error('Name is required.'); return; }
    if (!Number.isInteger(dur) || dur < 5 || dur > 480) {
      toast.error('Duration must be between 5 and 480 minutes.');
      return;
    }
    setSaving(true);
    try {
      let saved: BookingEventType;
      if (existing) {
        saved = await updateEventType(existing.id, {
          name: name.trim(),
          durationMinutes: dur,
          description: description.trim() || null,
          active,
        });
      } else {
        saved = await createEventType({
          name: name.trim(),
          durationMinutes: dur,
          description: description.trim() || undefined,
          active,
        });
      }
      toast.success(existing ? 'Event type updated.' : 'Event type created.');
      onSaved(saved);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
      <div className="space-y-1.5">
        <Label htmlFor="et-name">Name</Label>
        <Input
          id="et-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. 30-minute call"
          maxLength={80}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="et-duration">Duration (minutes)</Label>
        <Input
          id="et-duration"
          type="number"
          min={5}
          max={480}
          step={5}
          value={durationMinutes}
          onChange={e => setDurationMinutes(e.target.value)}
          className="w-32"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="et-description">Description (optional)</Label>
        <Textarea
          id="et-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description shown to visitors"
          rows={2}
          maxLength={300}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="et-active"
          checked={active}
          onChange={e => setActive(e.target.checked)}
          className="size-4 rounded accent-primary cursor-pointer"
        />
        <Label htmlFor="et-active" className="cursor-pointer">Active (visible to visitors)</Label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving
            ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            : <Save className="size-3.5 mr-1.5" />}
          {existing ? 'Save changes' : 'Create'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          <X className="size-3.5 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}
