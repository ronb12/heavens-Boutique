import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Bearer token from Vercel Node request headers */
export function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function requireUser(req) {
  const token = getBearer(req);
  if (!token) return { error: 'Unauthorized', status: 401 };
  const decoded = verifyToken(token);
  if (!decoded?.sub) return { error: 'Invalid token', status: 401 };
  return { userId: decoded.sub, role: decoded.role || 'customer' };
}

/** Valid Bearer JWT → user; missing/invalid token → userId null (no error). */
export function optionalUser(req) {
  const token = getBearer(req);
  if (!token) return { userId: null, role: null };
  const decoded = verifyToken(token);
  if (!decoded?.sub) return { userId: null, role: null };
  return { userId: decoded.sub, role: decoded.role || 'customer' };
}

/**
 * Admin authorization uses the database role (source of truth), not the JWT claim.
 * That way accounts promoted to admin in Postgres (or via login promotion) work
 * without forcing a new token when only the DB was updated.
 */
export async function requireAdmin(req) {
  const r = requireUser(req);
  if (r.error) return r;
  const sql = getDb();
  const rows = await sql`SELECT role FROM users WHERE id = ${r.userId} LIMIT 1`;
  if (rows[0]?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }
  return { userId: r.userId, role: 'admin' };
}
