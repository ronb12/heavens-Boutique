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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const productId = url.searchParams.get('productId');
    const variantId = url.searchParams.get('variantId');

    let rows;
    if (variantId) {
      rows = await sql`
        SELECT ia.*, pv.size, p.name AS product_name
        FROM inventory_audit ia
        JOIN product_variants pv ON pv.id = ia.variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE ia.variant_id = ${variantId}
        ORDER BY ia.created_at DESC
        LIMIT 200
      `;
    } else if (productId) {
      rows = await sql`
        SELECT ia.*, pv.size, p.name AS product_name
        FROM inventory_audit ia
        JOIN product_variants pv ON pv.id = ia.variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE p.id = ${productId}
        ORDER BY ia.created_at DESC
        LIMIT 200
      `;
    } else {
      rows = await sql`
        SELECT ia.*, pv.size, p.name AS product_name
        FROM inventory_audit ia
        JOIN product_variants pv ON pv.id = ia.variant_id
        JOIN products p ON p.id = pv.product_id
        ORDER BY ia.created_at DESC
        LIMIT 200
      `;
    }

    return json(res, 200, {
      rows: rows.map((r) => ({
        id: r.id,
        variantId: r.variant_id,
        productName: r.product_name,
        size: r.size,
        delta: r.delta,
        reason: r.reason,
        actorUserId: r.actor_user_id,
        orderId: r.order_id,
        meta: r.meta,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 500, { error: 'Database missing inventory_audit table. Run migration 013_inventory_audit.sql.' });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

