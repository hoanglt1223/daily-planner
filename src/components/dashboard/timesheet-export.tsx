import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Calendar } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_TZ, addDays, startOfWeek, fmtIsoDate } from '@/lib/time-utils';
import { generateIcs, downloadIcs } from '@/lib/ics-export';

type Block = {
  id: string; taskId: string | null; title: string;
  startAt: string; endAt: string;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped' | 'pending';
  note: string | null;
};

type Category = { id: string; name: string; color: string };
type Task = { id: string; categoryId: string | null };

const STATUS_LABELS: Record<Block['status'], string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
  pending: 'Pending',
};

export function TimesheetExport() {
  const weekStart = startOfWeek(new Date());
  const [from, setFrom] = useState(fmtIsoDate(weekStart));
  const [to, setTo] = useState(fmtIsoDate(addDays(weekStart, 7)));
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState<'csv' | 'ics' | null>(null);

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T00:00:00`);
      const [b, c, t] = await Promise.all([
        apiFetch<Block[]>(`/api/time-blocks?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`),
        apiFetch<Category[]>('/api/categories'),
        apiFetch<Task[]>('/api/tasks'),
      ]);
      setBlocks(b);
      setCategories(c);
      setTasks(t);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const taskCatMap = useMemo(() => {
    const m = new Map<string, string | null>();
    tasks.forEach(t => m.set(t.id, t.categoryId));
    return m;
  }, [tasks]);

  const rows = useMemo(() => {
    return blocks
      .map(b => {
        const start = new Date(b.startAt);
        const end = new Date(b.endAt);
        const durMin = Math.round((end.getTime() - start.getTime()) / 60_000);
        const catId = b.taskId ? taskCatMap.get(b.taskId) ?? null : null;
        const cat = catId ? catMap.get(catId) : null;
        return {
          date: formatInTimeZone(start, DEFAULT_TZ, 'yyyy-MM-dd'),
          dayName: formatInTimeZone(start, DEFAULT_TZ, 'EEE'),
          title: b.title,
          category: cat?.name ?? '',
          startTime: formatInTimeZone(start, DEFAULT_TZ, 'HH:mm'),
          endTime: formatInTimeZone(end, DEFAULT_TZ, 'HH:mm'),
          durationMin: durMin,
          status: STATUS_LABELS[b.status],
          note: b.note ?? '',
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [blocks, catMap, taskCatMap]);

  const totalMin = rows.reduce((s, r) => s + r.durationMin, 0);

  function downloadCsv() {
    const header = 'Date,Day,Title,Category,Start,End,Duration (min),Status,Note';
    const csvRows = rows.map(r =>
      [r.date, r.dayName, csvEscape(r.title), csvEscape(r.category),
        r.startTime, r.endTime, r.durationMin, r.status, csvEscape(r.note)].join(',')
    );
    const summary = `,,Total,,,,"${totalMin}",,`;
    const csv = [header, ...csvRows, '', summary].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExported('csv');
    setTimeout(() => setExported(null), 2000);
  }

  function downloadIcsFile() {
    const icsContent = generateIcs(blocks);
    downloadIcs(icsContent, `timesheet-${from}-to-${to}.ics`);
    setExported('ics');
    setTimeout(() => setExported(null), 2000);
  }

  function csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">Export timesheet</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="ts-from" className="text-xs">From</Label>
            <Input id="ts-from" type="date" value={from}
              onChange={e => setFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ts-to" className="text-xs">To</Label>
            <Input id="ts-to" type="date" value={to}
              onChange={e => setTo(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No time blocks in this range.</p>
        ) : (
          <>
            {/* Preview summary */}
            <div className="rounded-md border p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Blocks</span>
                <span className="font-medium">{rows.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total time</span>
                <span className="font-medium">{fmtHm(totalMin)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium text-emerald-600">
                  {fmtHm(rows.filter(r => r.status === 'Completed').reduce((s, r) => s + r.durationMin, 0))}
                </span>
              </div>
            </div>

            {/* Mini preview table */}
            <div className="max-h-40 overflow-auto rounded-md border text-xs">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">Date</th>
                    <th className="px-2 py-1.5 font-medium">Title</th>
                    <th className="px-2 py-1.5 font-medium text-right">Min</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 tabular-nums">{r.dayName} {r.date.slice(5)}</td>
                      <td className="px-2 py-1 truncate max-w-32">{r.title}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.durationMin}</td>
                      <td className="px-2 py-1">
                        <span className={
                          r.status === 'Completed' ? 'text-emerald-600' :
                          r.status === 'Skipped' ? 'text-muted-foreground' :
                          'text-foreground'
                        }>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length > 10 && (
                    <tr className="border-t text-muted-foreground">
                      <td colSpan={4} className="px-2 py-1 text-center">
                        +{rows.length - 10} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            className="w-full"
            disabled={loading || rows.length === 0}
            onClick={downloadCsv}
          >
            <Download className="size-3.5 mr-1.5" />
            {exported === 'csv' ? 'Downloaded!' : 'Download CSV'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={loading || blocks.length === 0}
            onClick={downloadIcsFile}
          >
            <Calendar className="size-3.5 mr-1.5" />
            {exported === 'ics' ? 'Downloaded!' : 'Export Calendar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}m` : `${h}h`;
}
