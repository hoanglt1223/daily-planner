const TOKEN_KEY = 'auth_token';
const OWNER_KEY = 'owner_token';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  wrong_password: 'Incorrect current password.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have access to that.",
  not_found: 'Not found.',
  email_taken: 'That email is already registered.',
  too_many_requests: 'Too many requests. Please wait a moment.',
  slot_taken: 'That time slot is no longer available.',
  invalid_input: 'Some required fields are missing or invalid.',
  title_required: 'A title is required.',
  name_required: 'A name is required.',
  nothing_to_update: 'Nothing to update.',
  invalid_privacy: 'Please choose a valid privacy option.',
  date_required: 'A date is required.',
  token_required: 'This link is missing its token.',
  unknown_kind: 'Unsupported request.',
  method_not_allowed: 'That action is not allowed here.',
  server_error: 'Something went wrong on our end. Please try again.',
};

export function getAuthToken() { return localStorage.getItem(TOKEN_KEY); }
export function setAuthToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
export function clearAuthToken() { localStorage.removeItem(TOKEN_KEY); }

export function getOwnerToken() {
  let t = localStorage.getItem(OWNER_KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(OWNER_KEY, t);
  }
  return t;
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // Only set Content-Type for string bodies (not FormData/Blob/etc.)
  if (init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const jwt = getAuthToken();
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  headers.set('x-owner-token', getOwnerToken());

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }

  if (!res.ok) {
    let message: string;
    try {
      const json = await res.json() as Record<string, unknown>;
      const rawCode = typeof json.error === 'string' ? json.error : null;
      const rawMessage = (typeof json.message === 'string' ? json.message : null)
        ?? rawCode
        ?? JSON.stringify(json);
      message = (rawCode ? ERROR_MESSAGES[rawCode] : null) ?? rawMessage;
    } catch {
      message = await res.text().catch(() => res.statusText);
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ─── Habit API helpers ─── */

export async function fetchHabits() {
  return apiFetch('/api/habits');
}

export async function createHabit(data: {
  name: string;
  description?: string;
  frequency?: 'daily' | 'weekly';
  targetDays?: number[];
  color?: string;
  icon?: string;
  targetPerPeriod?: number;
}) {
  return apiFetch('/api/habits', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateHabit(habitId: string, data: {
  name?: string;
  description?: string;
  frequency?: 'daily' | 'weekly';
  targetDays?: number[];
  color?: string;
  icon?: string;
  targetPerPeriod?: number;
}) {
  return apiFetch(`/api/habits?id=${habitId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteHabit(habitId: string) {
  return apiFetch(`/api/habits?id=${habitId}`, { method: 'DELETE' });
}

export async function toggleHabitEntry(habitId: string, entryDate: string, completed?: boolean, note?: string) {
  return apiFetch('/api/habits?action=toggle', {
    method: 'POST',
    body: JSON.stringify({ habitId, entryDate, completed, note }),
  });
}

export async function fetchHabitEntries(habitId: string, from?: string, to?: string) {
  const params = new URLSearchParams({ habitId });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return apiFetch(`/api/habits?action=entries&${params.toString()}`);
}
