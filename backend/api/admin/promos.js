import { getDb } from '../../lib/db.js';
import { requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireStoreAccess(req, PERM.DISCOUNTS);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();

  try {
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const id = body.id != null ? String(body.id).trim() : '';
      if (!id) return json(res, 400, { error: 'id required' });

      if (body.delete === true) {
        const del = await sql`DELETE FROM promo_codes WHERE id = ${id} RETURNING id`;
        if (!del[0]) return json(res, 404, { error: 'Promo not found' });
        return json(res, 200, { ok: true });
      }

      const activeRaw = body.active;
      if (typeof activeRaw !== 'boolean') return json(res, 400, { error: 'active must be boolean' });

      const upd = await sql`
        UPDATE promo_codes
        SET active = ${activeRaw}
        WHERE id = ${id}
        RETURNING *
      `;
      const p = upd[0];
      if (!p) return json(res, 404, { error: 'Promo not found' });
      return json(res, 200, { promo: p });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = (url.searchParams.get('id') || '').trim();
      if (!id) return json(res, 400, { error: 'id required' });
      const del = await sql`DELETE FROM promo_codes WHERE id = ${id} RETURNING id`;
      if (!del[0]) return json(res, 404, { error: 'Promo not found' });
      return json(res, 200, { ok: true });
    }

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
    if (e.code === '23503') {
      return json(res, 409, {
        error:
          'Cannot delete this code while it is still referenced. Run DB migration 029_orders_promo_fk_on_delete_set_null.sql or remove linked records.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
