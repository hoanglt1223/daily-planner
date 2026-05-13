import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken, type JwtPayload } from './auth.js';

export type AuthedRequest = VercelRequest & { user?: JwtPayload; ownerToken?: string };

function extractToken(req: VercelRequest): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

export function tryAuth(req: AuthedRequest) {
  const tok = extractToken(req);
  if (tok) {
    try { req.user = verifyToken(tok); } catch { /* ignore */ }
  }
  const owner = req.headers['x-owner-token'];
  if (typeof owner === 'string') req.ownerToken = owner;
}

export function requireAuth(req: AuthedRequest, res: VercelResponse): JwtPayload | null {
  tryAuth(req);
  if (!req.user) { res.status(401).json({ error: 'unauthorized' }); return null; }
  return req.user;
}

export function requireAdmin(req: AuthedRequest, res: VercelResponse): JwtPayload | null {
  const u = requireAuth(req, res);
  if (!u) return null;
  if (u.role !== 'admin') { res.status(403).json({ error: 'forbidden' }); return null; }
  return u;
}
