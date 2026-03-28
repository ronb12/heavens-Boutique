import { getDb } from '../../lib/db.js';
import { requireUser, requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const id = req.query?.id;
  if (!id) return json(res, 400, { error: 'Missing id' });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      const o = rows[0];
      if (!o) return json(res, 404, { error: 'Not found' });
      if (o.user_id !== auth.userId) {
        const admin = requireAdmin(req);
        if (admin.error) return json(res, admin.status, { error: admin.error });
      }

      const items = await sql`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        INNER JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ${id}
      `;
      return json(res, 200, {
        order: {
          id: o.id,
          status: o.status,
          subtotalCents: o.subtotal_cents,
          discountCents: o.discount_cents,
          totalCents: o.total_cents,
          trackingNumber: o.tracking_number,
          createdAt: o.created_at,
          items: items.map((i) => ({
            id: i.id,
            productId: i.product_id,
            variantId: i.variant_id,
            quantity: i.quantity,
            unitPriceCents: i.unit_price_cents,
            productName: i.product_name,
          })),
        },
      });
    }

    if (req.method === 'PATCH') {
      const admin = requireAdmin(req);
      if (admin.error) return json(res, admin.status, { error: admin.error });

      const body = await readJson(req);
      const status = body.status;
      const trackingNumber = body.trackingNumber;

      if (status) {
        await sql`UPDATE orders SET status = ${status}, updated_at = now() WHERE id = ${id}`;
      }
      if (trackingNumber !== undefined) {
        await sql`UPDATE orders SET tracking_number = ${trackingNumber || null}, updated_at = now() WHERE id = ${id}`;
      }

      const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      const o = rows[0];
      if (!o) return json(res, 404, { error: 'Not found' });

      const label = status || trackingNumber !== undefined ? `Status: ${o.status}` : 'Your order was updated';
      await sql`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          ${o.user_id}, 'order', 'Order update',
          ${label},
          ${JSON.stringify({ orderId: id, status: o.status, trackingNumber: o.tracking_number })}::jsonb
        )
      `;

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
