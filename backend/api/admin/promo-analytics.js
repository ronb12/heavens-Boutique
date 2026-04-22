import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const sql = getDb();
  try {
    const rows = await sql`
      SELECT
        p.id,
        p.code,
        p.discount_type,
        p.discount_value,
        COUNT(r.id)::int AS redemption_count,
        COALESCE(SUM(r.discount_cents), 0)::int AS discount_cents,
        COALESCE(SUM(r.total_cents), 0)::int AS total_cents,
        MAX(r.created_at) AS last_redeemed_at
      FROM promo_codes p
      LEFT JOIN promo_redemptions r ON r.promo_id = p.id
      GROUP BY p.id
      ORDER BY redemption_count DESC, last_redeemed_at DESC NULLS LAST
      LIMIT 200
    `;

    return json(res, 200, {
      promos: rows.map((r) => ({
        id: r.id,
        code: r.code,
        discountType: r.discount_type,
        discountValue: r.discount_value,
        redemptionCount: r.redemption_count,
        discountCents: r.discount_cents,
        totalCents: r.total_cents,
        lastRedeemedAt: r.last_redeemed_at,
      })),
    });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 500, { error: 'Database missing promo_redemptions table. Run migration 015_promo_analytics.sql.' });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

