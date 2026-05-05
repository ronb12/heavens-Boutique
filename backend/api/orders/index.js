import { getDb } from '../../lib/db.js';
import { requireUser, requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, handleCors, withCorsContext } from '../../lib/http.js';
async function handler(req, res) {
  if (handleCors(req, res)) return;
  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const url = new URL(req.url, `http://${req.headers.host}`);
      const asAdmin = url.searchParams.get('all') === '1';

      if (asAdmin) {
        const admin = await requireStoreAccess(req, PERM.ORDERS);
        if (admin.error) return json(res, admin.status, { error: admin.error });
        const orders = await sql`
          SELECT o.*, u.email as user_email, u.full_name as user_name
          FROM orders o
          LEFT JOIN users u ON u.id = o.user_id
          ORDER BY o.created_at DESC
          LIMIT 200
        `;
        return json(res, 200, { orders: orders.map((o) => mapOrderRow(o, [])) });
      }

      const orders = await sql`
        SELECT * FROM orders WHERE user_id = ${auth.userId}
        ORDER BY created_at DESC
        LIMIT 100
      `;
      const result = [];
      for (const o of orders) {
        const items = await sql`
          SELECT oi.*, p.name as product_name
          FROM order_items oi
          INNER JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ${o.id}
        `;
        result.push(mapOrderRow(o, items));
      }
      return json(res, 200, { orders: result });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

function mapOrderRow(o, items) {
  return {
    id: o.id,
    userId: o.user_id,
    userEmail: o.user_email || o.guest_email || null,
    userName: o.user_name,
    status: o.status,
    subtotalCents: o.subtotal_cents,
    discountCents: o.discount_cents,
    taxCents: o.tax_cents,
    shippingCents: o.shipping_cents,
    totalCents: o.total_cents,
    trackingNumber: o.tracking_number,
    stripePaymentIntentId: o.stripe_payment_intent_id,
    createdAt: o.created_at,
    items: (items || []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      variantId: i.variant_id,
      quantity: i.quantity,
      unitPriceCents: i.unit_price_cents,
      productName: i.product_name,
    })),
  };
}
export default withCorsContext(handler);
