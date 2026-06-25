/**
 * Parser tests for parse-quick-add.ts
 *
 * Install vitest to run:
 *   npm i -D vitest
 *   npx vitest run src/lib/parse-quick-add.test.ts
 *
 * These tests serve as living documentation of the parser grammar.
 */

import { parseQuickAdd } from './parse-quick-add';

// vitest injects these globals when running under its transform.
// The declarations let tsc compile this file without requiring the package installed.
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
interface Matchers {
  toBe(expected: unknown): void;
  toBeUndefined(): void;
  toBeTruthy(): void;
  toContain(item: unknown): void;
  toEqual(expected: unknown): void;
}
declare function expect(val: unknown): Matchers;

// Reference: Thursday 2026-06-25 local time (UTC+7 = system TZ on this server).
// Using new Date(year, month, day, ...) so getDay() is unambiguously Thursday=4.
const REF = new Date(2026, 5, 25, 8, 0, 0); // Thu Jun 25 2026 08:00 local

describe('parseQuickAdd — title only', () => {
  it('returns bare title when no tokens present', () => {
    const r = parseQuickAdd('draft report', REF);
    expect(r.title).toBe('draft report');
    expect(r.priority).toBeUndefined();
    expect(r.dueDate).toBeUndefined();
  });

  it('falls back to full input when only a token was typed', () => {
    expect(parseQuickAdd('!p2', REF).title).toBeTruthy();
  });
});

describe('parseQuickAdd — priority', () => {
  it('parses !p1', () => {
    const r = parseQuickAdd('fix bug !p1', REF);
    expect(r.priority).toBe(1);
    expect(r.title).toBe('fix bug');
  });

  it('parses !p4', () => {
    expect(parseQuickAdd('cleanup !p4', REF).priority).toBe(4);
  });
});

describe('parseQuickAdd — category / labels', () => {
  it('parses first #tag as categoryName', () => {
    const r = parseQuickAdd('write spec #work', REF);
    expect(r.categoryName).toBe('work');
    expect(r.title).toBe('write spec');
  });

  it('promotes second #tag to labels', () => {
    const r = parseQuickAdd('task #work #home', REF);
    expect(r.categoryName).toBe('work');
    expect(r.labels).toContain('home');
  });

  it('parses single @label', () => {
    const r = parseQuickAdd('read book @personal', REF);
    expect(r.labels).toContain('personal');
    expect(r.title).toBe('read book');
  });

  it('parses multiple @labels', () => {
    const r = parseQuickAdd('task @home @evening', REF);
    expect(r.labels).toContain('home');
    expect(r.labels).toContain('evening');
  });
});

describe('parseQuickAdd — dates (REF = Thu Jun 25 2026)', () => {
  it('parses today', () => {
    expect(parseQuickAdd('standup today', REF).dueDate).toBe('2026-06-25');
  });

  it('parses tomorrow', () => {
    expect(parseQuickAdd('review PR tomorrow', REF).dueDate).toBe('2026-06-26');
  });

  it('parses fri (next Friday from Thursday = +1 day)', () => {
    // Thu=4, Fri=5, diff=(5-4+7)%7=1 → Jun 26
    expect(parseQuickAdd('submit report fri', REF).dueDate).toBe('2026-06-26');
  });

  it('parses mon (next Monday from Thursday = +4 days)', () => {
    // Thu=4, Mon=1, diff=(1-4+7)%7=4 → Jun 29
    expect(parseQuickAdd('planning mon', REF).dueDate).toBe('2026-06-29');
  });

  it('parses saturday (next Saturday from Thursday = +2 days)', () => {
    // Thu=4, Sat=6, diff=(6-4+7)%7=2 → Jun 27
    expect(parseQuickAdd('errand sat', REF).dueDate).toBe('2026-06-27');
  });

  it('parses wednesday (next Wednesday from Thursday = +6 days)', () => {
    // Thu=4, Wed=3, diff=(3-4+7)%7=6 → Jul 1
    expect(parseQuickAdd('sync wednesday', REF).dueDate).toBe('2026-07-01');
  });

  it('parses same-day weekday (thursday from thursday = today)', () => {
    // Thu=4, Thu=4, diff=0 → Jun 25
    expect(parseQuickAdd('checkin thursday', REF).dueDate).toBe('2026-06-25');
  });
});

describe('parseQuickAdd — times', () => {
  it('parses 3pm', () => {
    expect(parseQuickAdd('call client 3pm', REF).dueTime).toBe('15:00');
  });

  it('parses 9am', () => {
    expect(parseQuickAdd('standup 9am', REF).dueTime).toBe('09:00');
  });

  it('parses 3:30pm', () => {
    expect(parseQuickAdd('meeting 3:30pm', REF).dueTime).toBe('15:30');
  });

  it('parses 24h time 14:00', () => {
    expect(parseQuickAdd('lunch 14:00', REF).dueTime).toBe('14:00');
  });

  it('parses 12pm as noon', () => {
    expect(parseQuickAdd('lunch 12pm', REF).dueTime).toBe('12:00');
  });

  it('parses 12am as midnight', () => {
    expect(parseQuickAdd('midnight run 12am', REF).dueTime).toBe('00:00');
  });
});

describe('parseQuickAdd — full expression', () => {
  it('parses "draft report fri 3pm !p1 #work @home" from Thursday', () => {
    // fri from Thu = Jun 26
    const r = parseQuickAdd('draft report fri 3pm !p1 #work @home', REF);
    expect(r.title).toBe('draft report');
    expect(r.dueDate).toBe('2026-06-26');
    expect(r.dueTime).toBe('15:00');
    expect(r.priority).toBe(1);
    expect(r.categoryName).toBe('work');
    expect(r.labels).toContain('home');
  });
});
