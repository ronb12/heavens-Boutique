import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';
import { selectStaffFieldsByUserId } from './userStaffRow.js';

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
  if (hash == null || hash === '') return false;
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

/** Granular permission keys for role=staff (ignored for admins). */
export const PERM = {
  ORDERS: 'orders',
  PRODUCTS: 'products',
  INVENTORY: 'inventory',
  CUSTOMERS: 'customers',
  RETURNS: 'returns',
  DISCOUNTS: 'discounts',
  GIFT_CARDS: 'giftCards',
  CONTENT: 'content',
  HOMEPAGE: 'homepage',
  MARKETING: 'marketing',
  REPORTS: 'reports',
  SETTINGS: 'settings',
  PURCHASE_ORDERS: 'purchaseOrders',
  PROMO_ANALYTICS: 'promoAnalytics',
  PRODUCTS_CSV: 'productsCsv',
};

const PERM_KEYS = Object.values(PERM);

export function normalizeStaffPermissions(raw) {
  const out = {};
  for (const k of PERM_KEYS) out[k] = Boolean(raw?.[k]);
  return out;
}

function staffHasAnyPermission(perms) {
  return PERM_KEYS.some((k) => perms[k]);
}

/**
 * Store owner only — invites staff, edits Stripe/EasyPost when restricted from staff.
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

/**
 * Admin or active staff with at least one permission flag (store team).
 * When `permissionKey` is set, staff must have that permission; admins always pass.
 */
export async function requireStoreAccess(req, permissionKey = null) {
  const r = requireUser(req);
  if (r.error) return r;
  const sql = getDb();
  const rows = await selectStaffFieldsByUserId(sql, r.userId);
  const row = rows[0];
  if (!row) return { error: 'Forbidden', status: 403 };
  if (row.role === 'admin') {
    return { userId: r.userId, role: 'admin', permissions: null };
  }
  if (row.role !== 'staff') return { error: 'Forbidden', status: 403 };
  if (row.staff_active === false) return { error: 'Forbidden', status: 403 };
  const permissions = normalizeStaffPermissions(row.staff_permissions);
  if (!permissionKey) {
    if (!staffHasAnyPermission(permissions)) return { error: 'Forbidden', status: 403 };
    return { userId: r.userId, role: 'staff', permissions };
  }
  if (!permissions[permissionKey]) return { error: 'Forbidden', status: 403 };
  return { userId: r.userId, role: 'staff', permissions };
}

/**
 * Staff may have any one of `permissionKeys` (OR). Admins always pass.
 */
export async function requireStoreAccessAny(req, permissionKeys) {
  const r = requireUser(req);
  if (r.error) return r;
  const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];
  if (keys.length === 0) return requireStoreAccess(req, null);

  const sql = getDb();
  const rows = await selectStaffFieldsByUserId(sql, r.userId);
  const row = rows[0];
  if (!row) return { error: 'Forbidden', status: 403 };
  if (row.role === 'admin') {
    return { userId: r.userId, role: 'admin', permissions: null };
  }
  if (row.role !== 'staff') return { error: 'Forbidden', status: 403 };
  if (row.staff_active === false) return { error: 'Forbidden', status: 403 };
  const permissions = normalizeStaffPermissions(row.staff_permissions);
  const ok = keys.some((k) => permissions[k]);
  if (!ok) return { error: 'Forbidden', status: 403 };
  return { userId: r.userId, role: 'staff', permissions };
}

/** Product cost / supplier fields: admins or staff with catalog access. */
export async function optionalAdmin(req) {
  const r = requireUser(req);
  if (r.error) return { isAdmin: false };
  const sql = getDb();
  const rows = await selectStaffFieldsByUserId(sql, r.userId);
  const row = rows[0];
  if (!row) return { isAdmin: false };
  if (row.role === 'admin') return { isAdmin: true };
  if (row.role === 'staff' && row.staff_active !== false) {
    const permissions = normalizeStaffPermissions(row.staff_permissions);
    if (permissions[PERM.PRODUCTS]) return { isAdmin: true };
  }
  return { isAdmin: false };
}
