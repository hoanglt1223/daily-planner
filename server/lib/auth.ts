import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Fail fast on a missing secret. Returning from a function (instead of a
// bare top-level guard) gives SECRET a non-undefined `string` type that
// narrows correctly inside the closures below.
function requireSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error(
      'JWT_SECRET is not set. Refusing to start with an insecure default. ' +
      'Set JWT_SECRET in the environment (Vercel project settings + .env.local for local dev).'
    );
  }
  return s;
}

const SECRET = requireSecret();
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
