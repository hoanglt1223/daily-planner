/**
 * Deterministic client-side parser for quick-add task input.
 *
 * Supported grammar:
 *   title [date] [time] [!p1..!p4] [#categoryName] [@label...]
 *
 * Date tokens (case-insensitive):
 *   today | tomorrow | mon | tue | wed | thu | fri | sat | sun
 *   (weekday names resolve to the next occurrence of that day, today included)
 *
 * Time tokens:
 *   3pm | 3am | 3:30pm | 15:30 | 15 (bare 2-digit hour only if < 24)
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

// ─── Parser ───────────────────────────────────────────────────────────────

export function parseQuickAdd(input: string, referenceDate?: Date): QuickAddResult {
  let text = input.trim();
  const now = referenceDate ?? new Date();

  let priority: number | undefined;
  let dueDate: string | undefined;
  let dueTime: string | undefined;
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

  // 4. Extract time (before date so "3pm fri" doesn't eat "fri" accidentally)
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

  // 5. Extract date
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

  // 6. Cleanup remaining text for title
  const title = text.replace(/\s+/g, ' ').trim();

  return {
    title: title || input.trim(), // fallback to full input if nothing left
    ...(dueDate !== undefined && { dueDate }),
    ...(dueTime !== undefined && { dueTime }),
    ...(priority !== undefined && { priority }),
    ...(categoryName !== undefined && { categoryName }),
    ...(labels.length > 0 && { labels }),
  };
}
