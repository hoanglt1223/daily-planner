import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface TaskReminderSettingsProps {
  reminderEnabled: boolean;
  reminderMinutes: number | null;
  onReminderEnabledChange: (enabled: boolean) => void;
  onReminderMinutesChange: (minutes: number | null) => void;
}

const REMINDER_PRESETS = [
  { label: 'At due time', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
];

export function TaskReminderSettings({
  reminderEnabled,
  reminderMinutes,
  onReminderEnabledChange,
  onReminderMinutesChange,
}: TaskReminderSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label htmlFor="reminder-enabled">Enable Reminder</Label>
          <p className="text-sm text-muted-foreground">
            Get browser notifications before this task is due
          </p>
        </div>
        <input
          id="reminder-enabled"
          type="checkbox"
          checked={reminderEnabled}
          onChange={(e) => onReminderEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
      </div>

      {reminderEnabled && (
        <div className="space-y-2">
          <Label>Remind me</Label>
          <div className="flex flex-wrap gap-2">
            {REMINDER_PRESETS.map((preset) => (
              <Badge
                key={preset.value}
                variant={reminderMinutes === preset.value ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => onReminderMinutesChange(preset.value)}
              >
                {preset.label}
              </Badge>
            ))}
          </div>
          {reminderMinutes !== null && (
            <p className="text-sm text-muted-foreground">
              You'll be notified {reminderMinutes === 0 ? 'when the task is due' : `${reminderMinutes} minutes before the due time`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
