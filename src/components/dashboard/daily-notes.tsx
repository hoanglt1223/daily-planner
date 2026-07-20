import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Loader2, Save, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, fmtIsoDate, startOfDay } from '@/lib/time-utils';
import { cn } from '@/lib/utils';

type ReflectionData = {
  mood?: string;
  wentWell?: string;
  toImprove?: string;
  tomorrowPriorities?: string;
};

type DailyNote = { id?: string; content: string; noteDate: string; reflectionData?: ReflectionData | null };

const MOOD_OPTIONS = ['😊 Great', '🙂 Good', '😐 Okay', '😔 Tough', '😰 Stressful'];

export function DailyNotes() {
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [note, setNote] = useState('');
  const [reflectionData, setReflectionData] = useState<ReflectionData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [promptsExpanded, setPromptsExpanded] = useState(true);
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
      setReflectionData(data.reflectionData ?? {});
    } catch {
      setNote('');
      setReflectionData({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNote(date); }, [date, loadNote]);

  // Save with debounce — snapshot the target date at schedule time to avoid
  // writing previous-day content to a new date after a day switch.
  function scheduleSave(content: string, reflection?: ReflectionData) {
    const targetDate = dateStr; // capture current date before any async gap
    setNote(content);
    if (reflection) setReflectionData(reflection);
    dirty.current = true;
    setSaved(false);
    setSaveError(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(content, targetDate, reflection), 1500);
  }

  async function doSave(content: string, targetDate: string, reflection?: ReflectionData) {
    setSaving(true);
    try {
      await apiFetch('/api/daily-notes', {
        method: 'PUT',
        body: JSON.stringify({
          date: targetDate,
          content,
          reflectionData: reflection ?? reflectionData,
        }),
      });
      dirty.current = false;
      setSaveError(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  // Force save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty.current) doSave(note, dateStr, reflectionData);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prevDay() { setDate(d => addDays(d, -1)); }
  function nextDay() { setDate(d => addDays(d, 1)); }

  const dayLabel = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const hasReflectionData = Boolean(
    reflectionData?.mood ||
    reflectionData?.wentWell ||
    reflectionData?.toImprove ||
    reflectionData?.tomorrowPriorities
  );

  return (
    <Card data-daily-notes>
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

        {/* Quick Reflection Prompts */}
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full justify-between px-2 h-7 text-xs"
            onClick={() => setPromptsExpanded(!promptsExpanded)}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3 text-primary" />
              Quick reflection
              {hasReflectionData && <span className="ml-1 text-muted-foreground">· filled</span>}
            </span>
            {promptsExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>

          {promptsExpanded && (
            <div className="space-y-2 pl-1">
              {/* Mood selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Today's mood
                </label>
                <div className="flex flex-wrap gap-1">
                  {MOOD_OPTIONS.map(mood => (
                    <button
                      key={mood}
                      type="button"
                      className={cn(
                        'px-2 py-1 rounded-md text-xs transition-colors',
                        reflectionData?.mood === mood
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                      onClick={() => scheduleSave(note, { ...reflectionData, mood })}
                    >
                      {mood.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Went well */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  What went well today?
                </label>
                <Textarea
                  value={reflectionData?.wentWell ?? ''}
                  onChange={e => scheduleSave(note, { ...reflectionData, wentWell: e.target.value })}
                  placeholder="Small wins, accomplishments..."
                  className="min-h-[60px] resize-none text-xs leading-relaxed py-2"
                />
              </div>

              {/* To improve */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  What could be improved?
                </label>
                <Textarea
                  value={reflectionData?.toImprove ?? ''}
                  onChange={e => scheduleSave(note, { ...reflectionData, toImprove: e.target.value })}
                  placeholder="Challenges, lessons learned..."
                  className="min-h-[60px] resize-none text-xs leading-relaxed py-2"
                />
              </div>

              {/* Tomorrow's priorities */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Top 3 priorities for tomorrow
                </label>
                <Textarea
                  value={reflectionData?.tomorrowPriorities ?? ''}
                  onChange={e => scheduleSave(note, { ...reflectionData, tomorrowPriorities: e.target.value })}
                  placeholder="1.  2.  3."
                  className="min-h-[60px] resize-none text-xs leading-relaxed py-2"
                />
              </div>
            </div>
          )}
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
          {saved && !saving && !saveError && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600">
              <Save className="size-3" /> Saved
            </span>
          )}
          {saveError && !saving && (
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] text-destructive hover:underline cursor-pointer"
              onClick={() => doSave(note, dateStr, reflectionData)}
            >
              Couldn&apos;t save — retry
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
