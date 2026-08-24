import { addDays, addWeeks, addMonths, format, startOfDay } from 'date-fns';

export type RecurringRule = {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  byDay?: number[]; // 0-6 (Sunday-Saturday) for weekly
  interval?: number; // Default: 1
  defaultTime?: string; // HH:mm format
  defaultDurationMinutes?: number;
  endsAfterOccurrences?: number | null;
  endsOnDate?: string | null; // ISO date string
};

export type PreviewInstance = {
  date: Date;
  time: string;
  duration: number;
  isSkipped: boolean;
  index: number;
};

/**
 * Generate preview instances for a recurring task
 * Returns up to 12 upcoming instances within the next 90 days
 */
export function generateRecurringPreview(
  startDate: Date,
  rule: RecurringRule,
  maxInstances: number = 12,
  maxDaysAhead: number = 90
): PreviewInstance[] {
  const instances: PreviewInstance[] = [];
  const defaultTime = rule.defaultTime || '09:00';
  const defaultDuration = rule.defaultDurationMinutes || 60;
  const interval = rule.interval || 1;
  let currentDate = startOfDay(startDate);

  // Set the time on the start date
  const [hours, minutes] = defaultTime.split(':').map(Number);
  currentDate.setHours(hours, minutes, 0, 0);

  const endDate = addDays(new Date(), maxDaysAhead);
  let count = 0;
  let instanceIndex = 0;
  let attempts = 0;
  const maxAttempts = 500; // Safety limit

  while (count < maxInstances && currentDate <= endDate && attempts < maxAttempts) {
    attempts++;

    let shouldInclude = false;

    switch (rule.freq) {
      case 'daily':
        shouldInclude = true;
        currentDate = addDays(currentDate, interval);
        break;

      case 'weekly':
        const dayOfWeek = currentDate.getDay();
        if (rule.byDay && rule.byDay.length > 0) {
          // Find the next matching day
          if (rule.byDay.includes(dayOfWeek)) {
            shouldInclude = true;
          }
          // Move to next day and continue checking
          currentDate = addDays(currentDate, 1);
        } else {
          // Same day each week
          shouldInclude = true;
          currentDate = addWeeks(currentDate, interval);
        }
        break;

      case 'monthly':
        shouldInclude = true;
        currentDate = addMonths(currentDate, interval);
        break;

      case 'yearly':
        shouldInclude = true;
        currentDate = addMonths(currentDate, interval * 12);
        break;
    }

    if (shouldInclude) {
      // Check end conditions
      if (rule.endsAfterOccurrences && instanceIndex >= rule.endsAfterOccurrences) {
        break;
      }
      if (rule.endsOnDate) {
        const endDate = new Date(rule.endsOnDate);
        if (currentDate > endDate) {
          break;
        }
      }

      instances.push({
        date: new Date(currentDate),
        time: defaultTime,
        duration: defaultDuration,
        isSkipped: false,
        index: instanceIndex,
      });

      count++;
      instanceIndex++;
    }
  }

  return instances;
}

/**
 * Get a human-readable description of the recurring pattern
 */
export function getRecurringPatternDescription(rule: RecurringRule): string {
  const interval = rule.interval || 1;
  const parts: string[] = [];

  switch (rule.freq) {
    case 'daily':
      parts.push(interval === 1 ? 'Daily' : `Every ${interval} days`);
      break;
    case 'weekly':
      if (rule.byDay && rule.byDay.length > 0) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = rule.byDay.map(d => days[d]).join(', ');
        parts.push(interval === 1 ? `Weekly on ${dayNames}` : `Every ${interval} weeks on ${dayNames}`);
      } else {
        parts.push(interval === 1 ? 'Weekly' : `Every ${interval} weeks`);
      }
      break;
    case 'monthly':
      parts.push(interval === 1 ? 'Monthly' : `Every ${interval} months`);
      break;
    case 'yearly':
      parts.push(interval === 1 ? 'Yearly' : `Every ${interval} years`);
      break;
  }

  if (rule.endsAfterOccurrences) {
    parts.push(`for ${rule.endsAfterOccurrences} occurrences`);
  } else if (rule.endsOnDate) {
    parts.push(`until ${format(new Date(rule.endsOnDate), 'MMM d, yyyy')}`);
  }

  const timeStr = rule.defaultTime || '9:00 AM';
  const durationStr = rule.defaultDurationMinutes ? ` (${rule.defaultDurationMinutes} min)` : '';
  parts.push(`at ${timeStr}${durationStr}`);

  return parts.join(' • ');
}

/**
 * Check if a date is within the preview window
 */
export function isInPreviewWindow(date: Date, maxDaysAhead: number = 90): boolean {
  const today = startOfDay(new Date());
  const futureLimit = addDays(today, maxDaysAhead);
  return date >= today && date <= futureLimit;
}