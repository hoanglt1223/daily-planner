import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Loader2, Save } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, fmtIsoDate, startOfDay } from '@/lib/time-utils';
import { cn } from '@/lib/utils';

type DailyNote = { id?: string; content: string; noteDate: string };

export function DailyNotes() {
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const dateStr = fmtIsoDate(date);
  const isToday = dateStr === fmtIsoDate(new Date());

  // Load note for the selected date
  const loadNote = useCallback(async (d: Date) => {
    setLoading(true);
    setSaved(false);
    try {
      const iso = fmtIsoDate(d);
      const data = await apiFetch<DailyNote>(`/api/daily-notes?date=${iso}`);
      setNote(data.content ?? '');
    } catch {
      setNote('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNote(date); }, [date, loadNote]);

  // Save with debounce
  function scheduleSave(content: string) {
    setNote(content);
    dirty.current = true;
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(content), 1500);
  }

  async function doSave(content: string) {
    setSaving(true);
    try {
      await apiFetch('/api/daily-notes', {
        method: 'PUT',
        body: JSON.stringify({ date: dateStr, content }),
      });
      dirty.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  // Force save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty.current) doSave(note);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prevDay() { setDate(d => addDays(d, -1)); }
  function nextDay() { setDate(d => addDays(d, 1)); }

  const dayLabel = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">Daily notes</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-6" onClick={prevDay}>
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className={cn(
              'text-xs font-medium min-w-[5.5rem] text-center',
              isToday && 'text-primary',
            )}>
              {dayLabel}
            </span>
            <Button size="icon" variant="ghost" className="size-6" onClick={nextDay}
              disabled={isToday}>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <Textarea
            value={note}
            onChange={e => scheduleSave(e.target.value)}
            placeholder={isToday ? 'Jot down thoughts, meeting notes, reflections...' : 'No notes for this day.'}
            className="min-h-[120px] resize-none text-sm leading-relaxed"
          />
        )}

        <div className="flex items-center justify-end gap-1.5 h-4">
          {saving && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Saving…
            </span>
          )}
          {saved && !saving && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600">
              <Save className="size-3" /> Saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
