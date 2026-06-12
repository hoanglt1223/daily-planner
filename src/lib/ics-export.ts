/**
 * ICS (iCalendar) export utility for Daily Planner
 * Generates RFC 5545 compliant .ics files from time blocks
 */

interface TimeBlock {
  id: string;
  taskId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  note: string | null;
}

interface IcsEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  description?: string;
  status?: string;
}

/**
 * Generate ICS content from time blocks
 */
export function generateIcs(blocks: TimeBlock[], options?: { calendarName?: string }): string {
  const calendarName = options?.calendarName || 'Daily Planner';

  const events = blocks.map(block => {
    const startDate = new Date(block.startAt);
    const endDate = new Date(block.endAt);

    // Format dates as ICS format: YYYYMMDDTHHMMSSZ
    const formatIcsDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const event: IcsEvent = {
      uid: `${block.id}@daily-planner`,
      summary: block.title,
      dtstart: formatIcsDate(startDate),
      dtend: formatIcsDate(endDate),
      description: block.note || undefined,
      status: block.status === 'completed' ? 'COMPLETED' :
              block.status === 'in_progress' ? 'IN_PROCESS' :
              block.status === 'skipped' ? 'CANCELLED' : 'TENTATIVE',
    };

    return event;
  });

  return buildIcs(events, calendarName);
}

/**
 * Build the ICS file content
 */
function buildIcs(events: IcsEvent[], calendarName: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daily Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
  ];

  events.forEach(event => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
    lines.push(`DTSTART:${event.dtstart}`);
    lines.push(`DTEND:${event.dtend}`);
    lines.push(`SUMMARY:${escapeIcs(event.summary)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    }

    if (event.status) {
      lines.push(`STATUS:${event.status}`);
    }

    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Escape special characters for ICS format
 */
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Download ICS file
 */
export function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
