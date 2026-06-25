import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type Privacy = 'details_to_managers' | 'busy_only_to_managers' | 'private';
type Me = { shareToken: string | null; privacy: Privacy };

const PRIVACY_LABELS: Record<Privacy, string> = {
  details_to_managers: 'Show full details to anyone with the link',
  busy_only_to_managers: 'Show busy/free only (no titles)',
  private: 'Private (link disabled)',
};

export function SharePanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    apiFetch<Me>('/api/auth/me')
      .then(setMe)
      .catch(() => setLoadError(true));
  }, []);

  async function enable() {
    setSaving(true);
    try {
      const r = await apiFetch<{ shareToken: string }>('/api/share/enable', { method: 'POST' });
      setMe(m => m ? { ...m, shareToken: r.shareToken } : m);
      toast.success('Share link enabled');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }
  async function disable() {
    setSaving(true);
    try {
      await apiFetch('/api/share/disable', { method: 'POST' });
      setMe(m => m ? { ...m, shareToken: null } : m);
      toast.success('Share link disabled');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }
  async function onPrivacyChange(privacy: Privacy) {
    const prev = me?.privacy;
    setMe(m => m ? { ...m, privacy } : m);
    try {
      await apiFetch('/api/share/privacy', { method: 'POST', body: JSON.stringify({ privacy }) });
      toast.success('Privacy updated');
    } catch (e) {
      setMe(m => m && prev ? { ...m, privacy: prev } : m);
      toast.error((e as Error).message);
    }
  }
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy to clipboard. Copy the link manually.');
    }
  }

  if (!me && loadError) {
    return (
      <Card>
        <CardContent className="p-5 text-center space-y-2">
          <p className="text-sm text-destructive">Failed to load share settings.</p>
        </CardContent>
      </Card>
    );
  }

  if (!me) return <SharePanelSkeleton />;

  const shareUrl = me.shareToken ? `${location.origin}/u/${me.shareToken}` : null;
  const bookUrl = me.shareToken ? `${location.origin}/book/${me.shareToken}` : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share my schedule</CardTitle>
        <CardDescription>Public read-only week + Calendly-style booking page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Privacy</Label>
          <RadioGroup value={me.privacy} onValueChange={v => onPrivacyChange(v as Privacy)}>
            {(Object.keys(PRIVACY_LABELS) as Privacy[]).map(p => (
              <div key={p} className="flex items-center gap-2">
                <RadioGroupItem id={`priv-${p}`} value={p} />
                <Label htmlFor={`priv-${p}`} className="text-xs font-normal cursor-pointer">
                  {PRIVACY_LABELS[p]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {!me.shareToken && (
          <Button onClick={enable} disabled={saving} size="sm">Enable share link</Button>
        )}
        {shareUrl && bookUrl && (
          <div className="space-y-2 text-xs">
            <LinkRow label="View schedule" url={shareUrl} onCopy={() => copy(shareUrl)} />
            <LinkRow label="Book a slot" url={bookUrl} onCopy={() => copy(bookUrl)} />
            <Button onClick={disable} disabled={saving} variant="ghost" size="sm"
              className="text-red-600 hover:text-red-700">Disable share</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LinkRow({ label, url, onCopy }: { label: string; url: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-muted-foreground">{label}:</span>
      <code className="flex-1 truncate rounded bg-muted px-2 py-1">{url}</code>
      <Button onClick={onCopy} variant="outline" size="sm">Copy</Button>
    </div>
  );
}

function SharePanelSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  );
}
