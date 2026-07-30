import { useEffect, useState } from 'react';
import {
  Globe, Lock, Save, Shield, Link2, Copy, RefreshCw, KeyRound, Loader2, ExternalLink,
  CalendarClock, Plus, Pencil, Trash2, Calendar, Palette,
} from 'lucide-react';
import { useTheme } from 'next-themes';
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
import { EventTypeForm } from '@/components/booking/event-type-form';
import { AvailabilityEditor } from '@/components/booking/availability-editor';
import {
  listEventTypes, deleteEventType, updateBookingSettings,
  type BookingEventType,
} from '@/lib/booking-api';

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
  bookingBufferMinutes: number;
  bookingMinNoticeMinutes: number;
  bookingHorizonDays: number;
  hourlyRate: number | null;
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

      <AppearanceSection />
      <ProfileSection profile={profile} onUpdated={setProfile} />
      <PrivacySection profile={profile} onUpdated={setProfile} />
      <ShareLinkSection profile={profile} onUpdated={setProfile} />
      <BookingSection profile={profile} onUpdated={setProfile} />
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
  const [hourlyRate, setHourlyRate] = useState(profile.hourlyRate === null ? '' : profile.hourlyRate.toString());
  const [saving, setSaving] = useState(false);

  const dirty = name !== profile.name || timezone !== profile.timezone || hourlyRate !== (profile.hourlyRate === null ? '' : profile.hourlyRate.toString());

  async function save() {
    setSaving(true);
    try {
      const rateValue = hourlyRate ? parseInt(hourlyRate, 10) : null;
      if (hourlyRate && (isNaN(rateValue!) || rateValue! < 0)) {
        toast.error('Hourly rate must be a positive number');
        setSaving(false);
        return;
      }

      const updated = await apiFetch<UserProfile>('/api/auth/update', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          timezone,
          hourlyRate: rateValue !== null ? rateValue : null,
        }),
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
        <div className="space-y-1.5">
          <Label htmlFor="settings-hourly-rate">Hourly rate (optional)</Label>
          <Input
            id="settings-hourly-rate"
            type="number"
            min="0"
            step="1"
            value={hourlyRate}
            onChange={e => setHourlyRate(e.target.value)}
            placeholder="e.g., 100"
          />
          <p className="text-[10px] text-muted-foreground">
            Used to calculate meeting costs. Leave blank to disable cost tracking.
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

/* ─── Appearance Section ─── */

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="size-4" /> Appearance
        </CardTitle>
        <CardDescription>Customize your visual experience.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')} className="gap-2">
          <label
            className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${
              theme === 'light'
                ? 'border border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'ring-hairline hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem value="light" id="theme-light" className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">Light mode</p>
              <p className="text-xs text-muted-foreground">Clean and bright interface for daytime use.</p>
            </div>
          </label>
          <label
            className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${
              theme === 'dark'
                ? 'border border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'ring-hairline hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem value="dark" id="theme-dark" className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">Dark mode</p>
              <p className="text-xs text-muted-foreground">Easy on the eyes for evening/night work sessions.</p>
            </div>
          </label>
          <label
            className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${
              theme === 'system'
                ? 'border border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'ring-hairline hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem value="system" id="theme-system" className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">System preference</p>
              <p className="text-xs text-muted-foreground">Automatically switches based on your device settings.</p>
            </div>
          </label>
        </RadioGroup>
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
  const icsFeedUrl = profile.shareToken ? `${appUrl}/api/share?token=${profile.shareToken}&action=ics` : null;

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
            {icsFeedUrl && (
              <div className="space-y-3">
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Calendar className="size-3" />
                    Calendar subscription feed
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Subscribe to see your planned time blocks in Google Calendar, Apple Calendar, Outlook, or any calendar app that supports ICS feeds.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input value={icsFeedUrl} readOnly className="text-xs font-mono" />
                    <Button size="icon" variant="outline" className="shrink-0" onClick={() => copyUrl(icsFeedUrl)} title="Copy">
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-1">
                  <p className="font-medium">How to subscribe:</p>
                  <ul className="space-y-0.5 ml-4 list-disc">
                    <li><strong>Google Calendar:</strong> Settings → Add calendar → From URL → paste feed URL</li>
                    <li><strong>Apple Calendar:</strong> File → New Calendar Subscription → paste feed URL</li>
                    <li><strong>Outlook:</strong> Add calendar → Subscribe from web → paste feed URL</li>
                  </ul>
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

/* ─── Booking Section ─── */

function BookingSection({ profile, onUpdated }: {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
}) {
  const [eventTypes, setEventTypes] = useState<BookingEventType[]>([]);
  const [loadingEt, setLoadingEt] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BookingEventType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Booking settings local state.
  const [buffer, setBuffer] = useState(String(profile.bookingBufferMinutes ?? 0));
  const [minNotice, setMinNotice] = useState(String(profile.bookingMinNoticeMinutes ?? 0));
  const [horizon, setHorizon] = useState(String(profile.bookingHorizonDays ?? 14));
  const [savingSettings, setSavingSettings] = useState(false);

  const settingsDirty =
    buffer !== String(profile.bookingBufferMinutes ?? 0) ||
    minNotice !== String(profile.bookingMinNoticeMinutes ?? 0) ||
    horizon !== String(profile.bookingHorizonDays ?? 14);

  useEffect(() => {
    listEventTypes()
      .then(setEventTypes)
      .catch(() => toast.error('Failed to load event types.'))
      .finally(() => setLoadingEt(false));
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteEventType(id);
      setEventTypes(prev => prev.filter(et => et.id !== id));
      toast.success('Event type deleted.');
    } catch (e) { toast.error((e as Error).message); }
    finally { setDeletingId(null); }
  }

  async function saveSettings() {
    const b = Number(buffer);
    const mn = Number(minNotice);
    const h = Number(horizon);
    if (!Number.isInteger(b) || b < 0 || b > 240) { toast.error('Buffer must be 0-240 minutes.'); return; }
    if (!Number.isInteger(mn) || mn < 0 || mn > 10080) { toast.error('Min notice must be 0-10080 minutes.'); return; }
    if (!Number.isInteger(h) || h < 1 || h > 365) { toast.error('Horizon must be 1-365 days.'); return; }
    setSavingSettings(true);
    try {
      const updated = await updateBookingSettings({
        bookingBufferMinutes: b,
        bookingMinNoticeMinutes: mn,
        bookingHorizonDays: h,
      });
      onUpdated({ ...profile, ...updated });
      toast.success('Booking settings saved.');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingSettings(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="size-4" /> Booking
        </CardTitle>
        <CardDescription>
          Configure what visitors can book on your public booking page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Event types */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Event types</Label>
            {!showForm && !editing && (
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                <Plus className="size-3.5 mr-1" /> New type
              </Button>
            )}
          </div>

          {showForm && (
            <EventTypeForm
              onSaved={et => { setEventTypes(prev => [...prev, et]); setShowForm(false); }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {loadingEt ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : eventTypes.length === 0 && !showForm ? (
            <p className="text-xs text-muted-foreground">
              No event types yet. Add one so visitors can book slots with you.
            </p>
          ) : (
            <div className="space-y-2">
              {eventTypes.map(et => (
                <div key={et.id}>
                  {editing?.id === et.id ? (
                    <EventTypeForm
                      existing={et}
                      onSaved={updated => {
                        setEventTypes(prev => prev.map(x => x.id === updated.id ? updated : x));
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-card">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{et.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {et.durationMinutes} min
                          {et.description ? ` · ${et.description}` : ''}
                          {!et.active && ' · inactive'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          size="icon" variant="ghost" className="size-7"
                          onClick={() => { setEditing(et); setShowForm(false); }}
                          aria-label="Edit event type"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(et.id)}
                          disabled={deletingId === et.id}
                          aria-label="Delete event type"
                        >
                          {deletingId === et.id
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : <Trash2 className="size-3.5" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Availability windows */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Weekly availability</Label>
          <p className="text-xs text-muted-foreground">
            Times are in your profile timezone ({profile.timezone}). Slots outside these windows will not be offered.
          </p>
          <AvailabilityEditor />
        </div>

        <Separator />

        {/* Booking settings */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Booking rules</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="booking-buffer" className="text-xs">Buffer between bookings (min)</Label>
              <Input
                id="booking-buffer"
                type="number"
                min={0}
                max={240}
                step={5}
                value={buffer}
                onChange={e => setBuffer(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Gap added after each booking.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-notice" className="text-xs">Min notice (min)</Label>
              <Input
                id="booking-notice"
                type="number"
                min={0}
                max={10080}
                step={30}
                value={minNotice}
                onChange={e => setMinNotice(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">How far ahead bookings must be made.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-horizon" className="text-xs">Horizon (days)</Label>
              <Input
                id="booking-horizon"
                type="number"
                min={1}
                max={365}
                step={1}
                value={horizon}
                onChange={e => setHorizon(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">How far into the future slots are shown.</p>
            </div>
          </div>
          <Button size="sm" onClick={saveSettings} disabled={!settingsDirty || savingSettings}>
            {savingSettings
              ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              : <Save className="size-3.5 mr-1.5" />}
            Save rules
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

