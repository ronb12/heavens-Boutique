import { getDb } from '../../lib/db.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const sql = getDb();
    const body = await readJson(req);
    const code = String(body.code || '').trim().toUpperCase();
    const subtotalCents = Number(body.subtotalCents) || 0;
    if (!code) return json(res, 400, { error: 'code required' });

    const promos = await sql`
      SELECT * FROM promo_codes
      WHERE UPPER(code) = ${code} AND active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (max_uses IS NULL OR uses_count < max_uses)
      LIMIT 1
    `;
    const p = promos[0];
    if (!p) {
      return json(res, 200, { valid: false });
    }

    let discountCents = 0;
    if (p.discount_type === 'percent') {
      discountCents = Math.floor((subtotalCents * p.discount_value) / 100);
    } else {
      discountCents = Math.min(subtotalCents, p.discount_value);
    }

    return json(res, 200, {
      valid: true,
      promoId: p.id,
      discountCents,
      code: p.code,
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
