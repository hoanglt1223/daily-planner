const TOKEN_KEY = 'auth_token';
const OWNER_KEY = 'owner_token';

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
      message = (typeof json.error === 'string' ? json.error : null)
        ?? (typeof json.message === 'string' ? json.message : null)
        ?? JSON.stringify(json);
    } catch {
      message = await res.text().catch(() => res.statusText);
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}
