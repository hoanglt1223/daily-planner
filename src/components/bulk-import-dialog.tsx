import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Plus, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { parseQuickAdd } from '@/lib/parse-quick-add';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Category { id: string; name: string; color: string }

interface ParsedLine {
  raw: string;
  title: string;
  dueDate?: string;
  priority?: number;
  categoryName?: string;
  labels?: string[];
  valid: boolean;
  error?: string;
}

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Urgent', 2: 'High', 3: 'Normal', 4: 'Low',
};

/* ─── Parse all lines into preview items ─── */

function parseLines(raw: string): ParsedLine[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (!line) return { raw: line, title: '', valid: false, error: 'Empty line' };
      const parsed = parseQuickAdd(line);
      if (!parsed.title) return { raw: line, title: '', valid: false, error: 'Could not extract title' };
      return { raw: line, ...parsed, valid: true };
    });
}

/* ─── Component ─── */

export function BulkImportDialog({ open, onOpenChange, categories, onDone }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Category[];
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) { setText(''); setResult(null); }
  }, [open]);

  const catMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach(c => m.set(c.name.toLowerCase(), c.id));
    return m;
  }, [categories]);

  const lines = useMemo(() => parseLines(text), [text]);
  const validLines = useMemo(() => lines.filter(l => l.valid), [lines]);
  const invalidLines = useMemo(() => lines.filter(l => !l.valid), [lines]);

  const handleImport = useCallback(async () => {
    if (validLines.length === 0) return;
    setImporting(true);
    let ok = 0;
    let fail = 0;

    // Create tasks sequentially to avoid rate-limit issues
    for (const line of validLines) {
      try {
        await apiFetch('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title: line.title,
            status: 'todo',
            priority: line.priority ?? 3,
            estimatedMinutes: 60,
            categoryId: line.categoryName ? (catMap.get(line.categoryName.toLowerCase()) ?? null) : null,
            dueDate: line.dueDate ?? null,
            labels: line.labels ?? [],
          }),
        });
        ok++;
      } catch {
        fail++;
      }
    }

    setResult({ ok, fail });
    setImporting(false);

    if (ok > 0) {
      toast.success(`${ok} task${ok > 1 ? 's' : ''} imported`);
      onDone();
    }
    if (fail > 0) toast.error(`${fail} task${fail > 1 ? 's' : ''} failed`);
  }, [validLines, catMap, onDone]);

  const placeholder = [
    'One task per line — supports quick-add syntax:',
    '',
    'draft report friday !p1 #work',
    'review PRs tomorrow 2pm @backend',
    'buy groceries !p4 @personal',
    'weekly standup mon 9am #meetings',
  ].join('\n');

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !importing) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Bulk import tasks
          </DialogTitle>
          <DialogDescription>
            Paste a list of tasks, one per line. Uses the same syntax as quick-add.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Textarea
            value={text}
            onChange={e => { setText(e.target.value); setResult(null); }}
            placeholder={placeholder}
            rows={8}
            className="font-mono text-xs resize-y"
            disabled={importing}
            autoFocus
          />

          {/* Live preview */}
          {lines.length > 0 && !result && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-md border p-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                {validLines.length} valid · {invalidLines.length} invalid
              </p>
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2 rounded px-2 py-1 text-xs',
                    line.valid ? 'bg-muted/40' : 'bg-destructive/5',
                  )}
                >
                  {line.valid ? (
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <span className="font-medium">{line.title}</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {line.dueDate && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            {line.dueDate}
                          </Badge>
                        )}
                        {line.priority && line.priority !== 3 && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            {PRIORITY_LABEL[line.priority]}
                          </Badge>
                        )}
                        {line.categoryName && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            #{line.categoryName}
                          </Badge>
                        )}
                        {(line.labels ?? []).map(l => (
                          <Badge key={l} variant="outline" className="text-[9px] px-1 py-0">
                            @{l}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="flex-1 text-destructive text-[11px]">
                      {line.error}: "{line.raw}"
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className="rounded-md border p-3 text-sm text-center space-y-1">
              <p className="font-medium">
                {result.ok > 0 && <span className="text-emerald-600">✓ {result.ok} imported</span>}
                {result.ok > 0 && result.fail > 0 && ' · '}
                {result.fail > 0 && <span className="text-destructive">✗ {result.fail} failed</span>}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={importing || validLines.length === 0}
            >
              {importing ? (
                <><Loader2 className="size-4 animate-spin mr-1.5" /> Importing…</>
              ) : (
                <><Plus className="size-4 mr-1.5" /> Import {validLines.length} task{validLines.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
