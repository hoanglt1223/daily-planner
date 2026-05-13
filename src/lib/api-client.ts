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
  headers.set('Content-Type', 'application/json');
  const jwt = getAuthToken();
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  headers.set('x-owner-token', getOwnerToken());

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}
