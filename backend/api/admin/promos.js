import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();

  try {
    if (req.method === 'POST') {
      const body = await readJson(req);
      const code = String(body.code || '').trim().toUpperCase();
      const discountType = body.discountType === 'fixed_cents' ? 'fixed_cents' : 'percent';
      const discountValue = Number(body.discountValue);
      const maxUses = body.maxUses != null ? Number(body.maxUses) : null;
      const expiresAt = body.expiresAt || null;

      if (!code || !Number.isFinite(discountValue) || discountValue <= 0) {
        return json(res, 400, { error: 'Invalid promo' });
      }

      const ins = await sql`
        INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, expires_at)
        VALUES (${code}, ${discountType}, ${discountValue}, ${maxUses}, ${expiresAt})
        RETURNING *
      `;
      const p = ins[0];
      return json(res, 201, {
        promo: {
          id: p.id,
          code: p.code,
          discountType: p.discount_type,
          discountValue: p.discount_value,
          maxUses: p.max_uses,
          expiresAt: p.expires_at,
        },
      });
    }

    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 100`;
      return json(res, 200, { promos: rows });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e.code === '23505') {
      return json(res, 409, { error: 'Code already exists' });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
