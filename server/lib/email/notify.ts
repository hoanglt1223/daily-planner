/**
 * Email notifications via Resend HTTP API. No SDK to keep bundle tiny.
 * If RESEND_API_KEY is unset, we log instead of failing — keeps dev frictionless.
 */

const ENDPOINT = 'https://api.resend.com/emails';

function fromAddr() {
  return process.env.EMAIL_FROM || 'Daily Planner <onboarding@resend.dev>';
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email-noop] to=${to} subj="${subject}"`);
    return;
  }
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddr(), to, subject, html }),
    });
    if (!r.ok) console.error('resend failed', r.status, await r.text());
  } catch (e) {
    console.error('resend error', e);
  }
}

function fmtRange(start: Date, end: Date, tz: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz, weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  };
  return `${new Intl.DateTimeFormat('en-GB', opts).format(start)} – ${
    new Intl.DateTimeFormat('en-GB', { ...opts, weekday: undefined, day: undefined, month: undefined }).format(end)
  }`;
}

export async function emailBookingCreated(args: {
  ownerEmail: string; ownerName: string; ownerTz: string;
  visitorName: string; visitorEmail: string;
  title: string; note?: string | null;
  startAt: Date; endAt: Date;
  bookingId: string; appUrl?: string;
}): Promise<void> {
  const url = `${args.appUrl ?? process.env.VITE_APP_URL ?? ''}/dashboard`;
  await send(args.ownerEmail, `New booking request: ${args.title}`, `
    <p>Hi ${escape(args.ownerName)},</p>
    <p><b>${escape(args.visitorName)}</b> (${escape(args.visitorEmail)}) requested a slot:</p>
    <ul>
      <li>${escape(args.title)}</li>
      <li>${fmtRange(args.startAt, args.endAt, args.ownerTz)}</li>
      ${args.note ? `<li>Note: ${escape(args.note)}</li>` : ''}
    </ul>
    <p><a href="${url}">Open dashboard to approve or reject</a>.</p>
  `);
}

export async function emailBookingDecision(args: {
  visitorEmail: string; visitorName: string;
  ownerName: string; ownerTz: string;
  title: string; startAt: Date; endAt: Date;
  approved: boolean;
}): Promise<void> {
  const subj = `${args.approved ? 'Confirmed' : 'Declined'}: ${args.title} with ${args.ownerName}`;
  await send(args.visitorEmail, subj, `
    <p>Hi ${escape(args.visitorName)},</p>
    <p>Your request for <b>${escape(args.title)}</b> at
       ${fmtRange(args.startAt, args.endAt, args.ownerTz)}
       was <b>${args.approved ? 'approved' : 'declined'}</b> by ${escape(args.ownerName)}.</p>
  `);
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
