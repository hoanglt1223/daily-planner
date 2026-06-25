import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// NOTE: insecure fallback retained TEMPORARILY so the app builds + runs while
// JWT_SECRET is being set in Vercel. The hardened fail-fast version (refuse to
// run without JWT_SECRET) is ready to re-apply once the secret exists in all
// Vercel environments. See feedback.md §0a.
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES_IN = '7d';

export type JwtPayload = { sub: string; email: string; role: 'user' | 'manager' | 'admin' };

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET, { algorithms: ['HS256'] }) as JwtPayload;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return test.length === ref.length && timingSafeEqual(test, ref);
}
