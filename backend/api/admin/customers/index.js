import { getDb } from '../../../lib/db.js';
import { requireAdmin, hashPassword } from '../../../lib/auth.js';
import { json, readJson, handleCors } from '../../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();

  if (req.method === 'POST') {
    try {
      const body = await readJson(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const fullName = body.fullName != null ? String(body.fullName).trim() || null : null;
      const phone = body.phone != null ? String(body.phone).trim() || null : null;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { error: 'Valid email required' });
      }
      if (!password || password.length < 8) {
        return json(res, 400, { error: 'Password must be at least 8 characters' });
      }

      const passwordHash = await hashPassword(password);
      const rows = await sql`
        INSERT INTO users (email, password_hash, full_name, phone, role)
        VALUES (${email}, ${passwordHash}, ${fullName}, ${phone}, 'customer')
        RETURNING id, email, full_name, phone, role, loyalty_points
      `;
      const u = rows[0];
      return json(res, 201, {
        customer: {
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          phone: u.phone,
          role: u.role,
          loyaltyPoints: u.loyalty_points ?? 0,
        },
      });
    } catch (e) {
      if (e.code === '23505') {
        return json(res, 409, { error: 'Email already registered' });
      }
      console.error(e);
      return json(res, 500, { error: 'Request failed' });
    }
  }

  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  try {
    const rows = await sql`
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.role,
        u.loyalty_points,
        u.tags,
        u.created_at,
        (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS order_count,
        (
          SELECT COALESCE(SUM(o.total_cents), 0)::bigint
          FROM orders o
          WHERE o.user_id = u.id
            AND o.status IN ('paid', 'shipped', 'delivered')
        ) AS spent_cents
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 250
    `;

    return json(res, 200, {
      customers: rows.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        phone: r.phone,
        role: r.role,
        loyaltyPoints: r.loyalty_points,
        tags: r.tags || [],
        createdAt: r.created_at,
        orderCount: Number(r.order_count) || 0,
        spentCents: toNum(r.spent_cents),
      })),
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'bigint') return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
