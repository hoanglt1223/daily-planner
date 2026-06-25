/**
 * Weekly availability editor.
 * Lets the owner define per-weekday time windows (start/end in HH:MM).
 * Multiple windows per day are supported (e.g. morning + afternoon).
 * Saves via PUT /api/bookings/availability (full replacement).
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listAvailability, replaceAvailability, type AvailabilityWindow } from '@/lib/booking-api';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Minutes-from-midnight to HH:MM string. */
function minsToHhmm(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** HH:MM string to minutes-from-midnight, or null if invalid. */
function hhmmToMins(hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = h * 60 + m;
  if (total < 0 || total > 1440) return null;
  return total;
}

interface EditWindow {
  key: string;
  weekday: number;
  startHhmm: string;
  endHhmm: string;
}

let keyCounter = 0;
function newKey() { return String(++keyCounter); }

function toEditWindows(rows: AvailabilityWindow[]): EditWindow[] {
  return rows.map(r => ({
    key: newKey(),
    weekday: r.weekday,
    startHhmm: minsToHhmm(r.startMinute),
    endHhmm: minsToHhmm(r.endMinute),
  }));
}

export function AvailabilityEditor() {
  const [windows, setWindows] = useState<EditWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listAvailability()
      .then(rows => setWindows(toEditWindows(rows)))
      .catch(() => toast.error('Failed to load availability.'))
      .finally(() => setLoading(false));
  }, []);

  function addWindow(weekday: number) {
    setWindows(prev => [...prev, { key: newKey(), weekday, startHhmm: '09:00', endHhmm: '17:00' }]);
  }

  function removeWindow(key: string) {
    setWindows(prev => prev.filter(w => w.key !== key));
  }

  function updateWindow(key: string, field: 'startHhmm' | 'endHhmm', value: string) {
    setWindows(prev => prev.map(w => w.key === key ? { ...w, [field]: value } : w));
  }

  async function save() {
    // Validate all windows.
    for (const w of windows) {
      const s = hhmmToMins(w.startHhmm);
      const e = hhmmToMins(w.endHhmm);
      if (s === null || e === null || e <= s) {
        toast.error(`Invalid window on ${WEEKDAYS[w.weekday]}: end must be after start.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = windows.map(w => ({
        weekday: w.weekday,
        startMinute: hhmmToMins(w.startHhmm)!,
        endMinute: hhmmToMins(w.endHhmm)!,
      }));
      await replaceAvailability(payload);
      toast.success('Availability saved.');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading availability…</p>;

  return (
    <div className="space-y-4">
      {WEEKDAYS.map((dayName, weekday) => {
        const dayWindows = windows.filter(w => w.weekday === weekday);
        return (
          <div key={weekday} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium w-24">{dayName}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => addWindow(weekday)}
              >
                <Plus className="size-3 mr-1" /> Add window
              </Button>
            </div>
            {dayWindows.length === 0 && (
              <p className="text-xs text-muted-foreground pl-1">Unavailable</p>
            )}
            {dayWindows.map(w => (
              <div key={w.key} className="flex items-center gap-2 pl-1">
                <Input
                  type="time"
                  value={w.startHhmm}
                  onChange={e => updateWindow(w.key, 'startHhmm', e.target.value)}
                  className="w-28 h-7 text-sm"
                  aria-label={`${dayName} window start`}
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="time"
                  value={w.endHhmm}
                  onChange={e => updateWindow(w.key, 'endHhmm', e.target.value)}
                  className="w-28 h-7 text-sm"
                  aria-label={`${dayName} window end`}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeWindow(w.key)}
                  aria-label="Remove window"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        );
      })}

      <Button size="sm" onClick={save} disabled={saving} className="mt-2">
        {saving
          ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          : <Save className="size-3.5 mr-1.5" />}
        Save availability
      </Button>
    </div>
  );
}
