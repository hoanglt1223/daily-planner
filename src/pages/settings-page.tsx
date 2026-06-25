import { useEffect, useState } from 'react';
import {
  Globe, Lock, Save, Shield, Link2, Copy, RefreshCw, KeyRound, Loader2, ExternalLink,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

/* ─── Types ─── */

type PrivacyMode = 'details_to_managers' | 'busy_only_to_managers' | 'private';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  privacy: PrivacyMode;
  timezone: string;
  shareToken: string | null;
}

/* ─── Constants ─── */

const COMMON_TIMEZONES = [
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

const PRIVACY_OPTIONS: Array<{ value: PrivacyMode; label: string; description: string }> = [
  {
    value: 'details_to_managers',
    label: 'Full details',
    description: 'Managers can see your block titles and task names.',
  },
  {
    value: 'busy_only_to_managers',
    label: 'Busy only',
    description: 'Managers see "Busy" instead of your block titles. (Default)',
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Managers cannot see your schedule at all.',
  },
];

/* ─── Page ─── */

export function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<UserProfile>('/api/auth/me')
      .then(setProfile)
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Could not load profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, privacy, and share link.</p>
      </div>

      <ProfileSection profile={profile} onUpdated={setProfile} />
      <PrivacySection profile={profile} onUpdated={setProfile} />
      <ShareLinkSection profile={profile} onUpdated={setProfile} />
      <PasswordSection />
    </div>
  );
}

/* ─── Profile Section ─── */

function ProfileSection({ profile, onUpdated }: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [saving, setSaving] = useState(false);

  const dirty = name !== profile.name || timezone !== profile.timezone;

  async function save() {
    setSaving(true);
    try {
      const updated = await apiFetch<UserProfile>('/api/auth/update', {
        method: 'PATCH',
        body: JSON.stringify({ name, timezone }),
      });
      onUpdated(updated);
      toast.success('Profile updated');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="size-4" /> Profile
        </CardTitle>
        <CardDescription>Your display name and timezone.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Display name</Label>
          <Input id="settings-name" value={name} onChange={e => setName(e.target.value)}
            maxLength={100} placeholder="Your name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-email">Email</Label>
          <Input id="settings-email" value={profile.email} disabled />
          <p className="text-[10px] text-muted-foreground">Email cannot be changed.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map(tz => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            Used for recurring task expansion and display formatting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{profile.role}</Badge>
          <span className="text-xs text-muted-foreground">Account role</span>
        </div>
        <Separator />
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Privacy Section ─── */

function PrivacySection({ profile, onUpdated }: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const [privacy, setPrivacy] = useState<PrivacyMode>(profile.privacy);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await apiFetch<UserProfile>('/api/auth/update', {
        method: 'PATCH',
        body: JSON.stringify({ privacy }),
      });
      onUpdated(updated);
      toast.success('Privacy setting updated');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="size-4" /> Privacy
        </CardTitle>
        <CardDescription>Control what managers can see about your schedule.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={privacy} onValueChange={v => setPrivacy(v as PrivacyMode)} className="gap-2">
          {PRIVACY_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${
                privacy === opt.value
                  ? 'border border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'ring-hairline hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value={opt.value} id={`privacy-${opt.value}`} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
        <Separator />
        <Button size="sm" onClick={save} disabled={privacy === profile.privacy || saving}>
          {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}
          Save privacy
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Share Link Section ─── */

function ShareLinkSection({ profile, onUpdated }: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const shareUrl = profile.shareToken ? `${appUrl}/u/${profile.shareToken}` : null;
  const bookingUrl = profile.shareToken ? `${appUrl}/book/${profile.shareToken}` : null;

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Failed to copy'),
    );
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      const result = await apiFetch<{ shareToken: string }>('/api/auth/regenerate-token', { method: 'POST' });
      onUpdated({ ...profile, shareToken: result.shareToken });
      toast.success('Share link regenerated');
    } catch (e) { toast.error((e as Error).message); }
    finally { setRegenerating(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="size-4" /> Share link
        </CardTitle>
        <CardDescription>Share your schedule publicly or accept bookings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {shareUrl ? (
          <>
            <div className="space-y-2">
              <Label className="text-xs">Read-only schedule</Label>
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="text-xs font-mono" />
                <Button size="icon" variant="outline" className="shrink-0" onClick={() => copyUrl(shareUrl)} title="Copy">
                  <Copy className="size-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="shrink-0" asChild title="Open">
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              </div>
            </div>
            {bookingUrl && (
              <div className="space-y-2">
                <Label className="text-xs">Booking page</Label>
                <div className="flex items-center gap-2">
                  <Input value={bookingUrl} readOnly className="text-xs font-mono" />
                  <Button size="icon" variant="outline" className="shrink-0" onClick={() => copyUrl(bookingUrl)} title="Copy">
                    <Copy className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="outline" className="shrink-0" asChild title="Open">
                    <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No share link generated yet.</p>
        )}
        <Separator />
        <Button size="sm" variant="outline" onClick={regenerate} disabled={regenerating}>
          {regenerating ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="size-3.5 mr-1.5" />}
          {shareUrl ? 'Regenerate link' : 'Generate link'}
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Regenerating invalidates the previous link.
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Password Section ─── */

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSave = currentPassword.length > 0 && newPassword.length >= 8 && !mismatch;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="size-4" /> Change password
        </CardTitle>
        <CardDescription>Update your account password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="settings-cur-pw">Current password</Label>
          <Input id="settings-cur-pw" type="password" value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-new-pw">New password</Label>
          <Input id="settings-new-pw" type="password" value={newPassword}
            onChange={e => setNewPassword(e.target.value)} minLength={8} autoComplete="new-password" />
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-[10px] text-red-500">Must be at least 8 characters.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-confirm-pw">Confirm new password</Label>
          <Input id="settings-confirm-pw" type="password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          {mismatch && (
            <p className="text-[10px] text-red-500">Passwords do not match.</p>
          )}
        </div>
        <Separator />
        <Button size="sm" onClick={save} disabled={!canSave || saving}>
          {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Lock className="size-3.5 mr-1.5" />}
          Change password
        </Button>
      </CardContent>
    </Card>
  );
}
