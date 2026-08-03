/**
 * Deterministic client-side parser for quick-add task input.
 *
 * Supported grammar:
 *   title [date] [time] [duration] [!p1..!p4] [#categoryName] [@label...]
 *
 * Date tokens (case-insensitive):
 *   today | tomorrow | mon | tue | wed | thu | fri | sat | sun
 *   (weekday names resolve to the next occurrence of that day, today included)
 *   in X days | in X weeks | next week
 *
 * Time tokens:
 *   3pm | 3am | 3:30pm | 15:30 | 15 (bare 2-digit hour only if < 24)
 *   morning | afternoon | evening | night
 *   2pm-4pm | 14:00-16:00 (time range with auto-duration)
 *
 * Duration tokens:
 *   30min | 2h | 1.5h | 90m
 *
 * Priority tokens:
 *   !p1 (Urgent) | !p2 (High) | !p3 (Normal) | !p4 (Low)
 *
 * Project token:
 *   #word  → categoryName (first one wins, rest become labels)
 *
 * Label tokens:
 *   @word  → label strings (multiple allowed)
 */

export interface QuickAddResult {
  title: string;
  dueDate?: string;     // ISO date string "YYYY-MM-DD"
  dueTime?: string;     // "HH:MM" in 24h, only set when time token was found
  endTime?: string;     // "HH:MM" in 24h, set when time range is provided
  durationMinutes?: number;  // Duration in minutes, from explicit duration or time range
  priority?: number;    // 1..4
  categoryName?: string;
  labels?: string[];
}

// ─── Weekday helpers ────────────────────────────────────────────────────────

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/** Return the next occurrence of iso-weekday `target` (0=Sun), today included. */
function nextWeekday(target: number, from: Date = new Date()): Date {
  const todayDow = from.getDay();
  const diff = (target - todayDow + 7) % 7;
  const d = new Date(from);
  d.setDate(d.getDate() + diff);
  return d;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Convert natural time expression to hour (0-23) */
function naturalTimeToHour(expression: string): number {
  const time = expression.toLowerCase();
  switch (time) {
    case 'morning': return 9;
    case 'afternoon': return 14;
    case 'evening': return 18;
    case 'night': return 20;
    default: return 9;
  }
}

/** Parse duration string to minutes */
function parseDurationToMinutes(value: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase();
  if (normalizedUnit.startsWith('h') || normalizedUnit.startsWith('hour')) {
    return Math.round(value * 60);
  }
  // minutes (min, m, minute)
  return Math.round(value);
}

/** Calculate time in minutes from midnight */
function timeToMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

// ─── Token regex patterns ─────────────────────────────────────────────────

// Priority: !p1..!p4
const RX_PRIORITY = /!p([1-4])\b/i;

// Date: today | tomorrow | weekday names
const DATE_WORDS = [
  'today', 'tomorrow',
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat',
].join('|');
const RX_DATE = new RegExp(`\\b(${DATE_WORDS})\\b`, 'i');

// Time: 3pm | 3:30pm | 15:30 | 3am (bare numbers only matched when followed by am/pm)
const RX_TIME = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/i;

// Category: #word (no spaces)
const RX_CATEGORY = /#(\S+)/g;

// Label: @word (no spaces)
const RX_LABEL = /@(\S+)/g;

// Duration: 30min | 2h | 1.5h | 90m | 45 minutes
const RX_DURATION = /\b(\d+\.?\d*)\s*(min|h|m|minutes?|hours?)\b/i;

// Time range: 2pm-4pm | 14:00-16:00 | 9am-11am
const RX_TIME_RANGE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)\b/i;

// Relative dates: in 3 days | in 2 weeks | next week | next month
const RX_RELATIVE_DATE = /\b(in\s+(\d+\.?\d*)\s+(days?|weeks?|months?))|(next\s+(week|month|day))\b/i;

// Natural time expressions: morning | afternoon | evening | night
const RX_NATURAL_TIME = /\b(morning|afternoon|evening|night)\b/i;

// ─── Parser ───────────────────────────────────────────────────────────────

export function parseQuickAdd(input: string, referenceDate?: Date): QuickAddResult {
  let text = input.trim();
  const now = referenceDate ?? new Date();

  let priority: number | undefined;
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  let endTime: string | undefined;
  let durationMinutes: number | undefined;
  let categoryName: string | undefined;
  const labels: string[] = [];

  // 1. Extract priority
  const mPriority = text.match(RX_PRIORITY);
  if (mPriority) {
    priority = Number(mPriority[1]);
    text = text.replace(mPriority[0], '');
  }

  // 2. Extract categories (#)
  const catMatches = [...text.matchAll(RX_CATEGORY)];
  for (const m of catMatches) {
    if (!categoryName) {
      categoryName = m[1];
    } else {
      // additional #tags become labels
      labels.push(m[1]);
    }
  }
  text = text.replace(RX_CATEGORY, '');

  // 3. Extract labels (@)
  const labelMatches = [...text.matchAll(RX_LABEL)];
  for (const m of labelMatches) {
    labels.push(m[1]);
  }
  text = text.replace(RX_LABEL, '');

  // 4. Extract time range (before single time, so "2pm-4pm" is processed)
  const mTimeRange = text.match(RX_TIME_RANGE);
  if (mTimeRange) {
    let startHour: number, startMin: number, endHour: number, endMin: number;

    if (mTimeRange[3]) {
      // form: 2pm-4pm
      startHour = Number(mTimeRange[1]);
      startMin = mTimeRange[2] ? Number(mTimeRange[2]) : 0;
      const startAmpm = mTimeRange[3].toLowerCase();
      if (startAmpm === 'pm' && startHour < 12) startHour += 12;
      if (startAmpm === 'am' && startHour === 12) startHour = 0;

      endHour = Number(mTimeRange[4]);
      endMin = mTimeRange[5] ? Number(mTimeRange[5]) : 0;
      const endAmpm = mTimeRange[6].toLowerCase();
      if (endAmpm === 'pm' && endHour < 12) endHour += 12;
      if (endAmpm === 'am' && endHour === 12) endHour = 0;
    } else {
      // form: 14:00-16:00
      startHour = Number(mTimeRange[7]);
      startMin = Number(mTimeRange[8]);
      endHour = Number(mTimeRange[9]);
      endMin = Number(mTimeRange[10]);
    }

    dueTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    // Calculate duration from time range
    const startMinutes = timeToMinutes(startHour, startMin);
    const endMinutes = timeToMinutes(endHour, endMin);
    durationMinutes = endMinutes - startMinutes;
    if (durationMinutes < 0) {
      // Handle overnight ranges (e.g., 11pm-1am)
      durationMinutes += 24 * 60;
    }

    text = text.replace(mTimeRange[0], '');
  }

  // 5. Extract duration (only if not already set from time range)
  if (!durationMinutes) {
    const mDuration = text.match(RX_DURATION);
    if (mDuration) {
      const value = parseFloat(mDuration[1]);
      const unit = mDuration[2];
      durationMinutes = parseDurationToMinutes(value, unit);
      text = text.replace(mDuration[0], '');
    }
  }

  // 6. Extract time (before date so "3pm fri" doesn't eat "fri" accidentally)
  if (!dueTime) {
    const mTime = text.match(RX_TIME);
    if (mTime) {
      if (mTime[3]) {
        // form: 3pm / 3:30am
        let h = Number(mTime[1]);
        const min = mTime[2] ? Number(mTime[2]) : 0;
        const ampm = mTime[3].toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        dueTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      } else {
        // form: 15:30
        dueTime = `${String(mTime[4]).padStart(2, '0')}:${mTime[5]}`;
      }
      text = text.replace(mTime[0], '');
    }
  }

  // 7. Extract natural time expressions (if no time set yet)
  if (!dueTime) {
    const mNaturalTime = text.match(RX_NATURAL_TIME);
    if (mNaturalTime) {
      const hour = naturalTimeToHour(mNaturalTime[1]);
      dueTime = `${String(hour).padStart(2, '0')}:00`;
      text = text.replace(mNaturalTime[0], '');
    }
  }

  // 8. Extract relative dates
  const mRelativeDate = text.match(RX_RELATIVE_DATE);
  if (mRelativeDate) {
    if (mRelativeDate[2]) {
      // form: "in X days/weeks/months"
      const value = parseFloat(mRelativeDate[3]);
      const unit = mRelativeDate[4].toLowerCase();
      const d = new Date(now);

      if (unit.startsWith('day')) {
        d.setDate(d.getDate() + Math.round(value));
        dueDate = isoDate(d);
      } else if (unit.startsWith('week')) {
        d.setDate(d.getDate() + Math.round(value * 7));
        dueDate = isoDate(d);
      } else if (unit.startsWith('month')) {
        d.setMonth(d.getMonth() + Math.round(value));
        dueDate = isoDate(d);
      }
      text = text.replace(mRelativeDate[0], '');
    } else if (mRelativeDate[6]) {
      // form: "next week/month/day"
      const unit = mRelativeDate[7].toLowerCase();
      const d = new Date(now);

      if (unit === 'week') {
        d.setDate(d.getDate() + 7);
        dueDate = isoDate(d);
      } else if (unit === 'month') {
        d.setMonth(d.getMonth() + 1);
        dueDate = isoDate(d);
      } else if (unit === 'day') {
        d.setDate(d.getDate() + 1);
        dueDate = isoDate(d);
      }
      text = text.replace(mRelativeDate[0], '');
    }
  }

  // 9. Extract absolute date words (today, tomorrow, weekdays)
  const mDate = text.match(RX_DATE);
  if (mDate) {
    const word = mDate[1].toLowerCase();
    if (word === 'today') {
      dueDate = isoDate(now);
    } else if (word === 'tomorrow') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      dueDate = isoDate(d);
    } else if (word in WEEKDAY_MAP) {
      dueDate = isoDate(nextWeekday(WEEKDAY_MAP[word], now));
    }
    text = text.replace(mDate[0], '');
  }

  // 10. Cleanup remaining text for title
  const title = text.replace(/\s+/g, ' ').trim();

  return {
    title: title || input.trim(), // fallback to full input if nothing left
    ...(dueDate !== undefined && { dueDate }),
    ...(dueTime !== undefined && { dueTime }),
    ...(endTime !== undefined && { endTime }),
    ...(durationMinutes !== undefined && { durationMinutes }),
    ...(priority !== undefined && { priority }),
    ...(categoryName !== undefined && { categoryName }),
    ...(labels.length > 0 && { labels }),
  };
}
