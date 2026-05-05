import { requireStoreAccess, PERM } from '../../auth.js';
import { json, readJson, handleCors } from '../../http.js';
import { getDb } from '../../db.js';
import { createShipment, buyRate } from '../../easypost.js';

/**
 * Handles /api/admin/easypost/:orderId/rates  (GET)
 *                /api/admin/easypost/:orderId/buy    (POST)
 */
export default async function handleEasyPost(req, res, segments) {
  if (handleCors(req, res)) return;
  const auth = await requireStoreAccess(req, PERM.ORDERS);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  // segments[0] = 'easypost', segments[1] = orderId, segments[2] = 'rates' | 'buy'
  const orderId = segments[1];
  const action = segments[2];

  if (!orderId) return json(res, 400, { error: 'Missing orderId' });

  const sql = getDb();

  const rows = await sql`
    SELECT o.*, u.email AS user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.id = ${orderId}
    LIMIT 1
  `;
  const order = rows[0];
  if (!order) return json(res, 404, { error: 'Order not found' });

  const shippingAddress = order.shipping_address;
  if (!shippingAddress) return json(res, 400, { error: 'Order has no shipping address' });

  // Sum total weight from order items + variants
  const weightRows = await sql`
    SELECT COALESCE(SUM(oi.quantity * pv.weight_oz), 8) AS total_oz
    FROM order_items oi
    JOIN product_variants pv ON pv.id = oi.variant_id
    WHERE oi.order_id = ${orderId}
  `;
  const weightOz = Number(weightRows[0]?.total_oz) || 8;
  const customerEmail = order.guest_email || order.user_email || '';
  const customerName = shippingAddress.name || 'Customer';

  if (action === 'rates' && req.method === 'GET') {
    // If we already have a shipment, reuse it; otherwise create new
    let shipmentId = order.easypost_shipment_id;
    let rates;
    if (shipmentId) {
      try {
        const { createShipment: cs } = await import('../../easypost.js');
        // Re-fetch existing shipment rates — simpler to just create fresh
        const fresh = await createShipment({ toAddress: shippingAddress, weightOz, customerName, customerEmail, sql });
        shipmentId = fresh.id;
        rates = fresh.rates;
        // Persist new shipment id
        await sql`UPDATE orders SET easypost_shipment_id = ${shipmentId} WHERE id = ${orderId}`;
      } catch {
        // fall through to create new
      }
    }
    if (!rates) {
      const fresh = await createShipment({ toAddress: shippingAddress, weightOz, customerName, customerEmail, sql });
      shipmentId = fresh.id;
      rates = fresh.rates;
      await sql`UPDATE orders SET easypost_shipment_id = ${shipmentId} WHERE id = ${orderId}`;
    }
    return json(res, 200, { shipmentId, rates });
  }

  if (action === 'buy' && req.method === 'POST') {
    const body = await readJson(req);
    const { shipmentId: reqShipmentId, rateId } = body;
    if (!rateId) return json(res, 400, { error: 'rateId is required' });
    const shipmentId = reqShipmentId || order.easypost_shipment_id;
    if (!shipmentId) return json(res, 400, { error: 'shipmentId is required (fetch rates first)' });

    const result = await buyRate(shipmentId, rateId, sql);

    await sql`
      UPDATE orders SET
        easypost_shipment_id  = ${result.shipmentId},
        easypost_tracker_id   = ${result.trackerId},
        label_url             = ${result.labelUrl},
        carrier               = ${result.carrier},
        service               = ${result.service},
        tracking_number       = ${result.trackingCode},
        fulfillment_status    = 'label_purchased',
        updated_at            = now()
      WHERE id = ${orderId}
    `;

    return json(res, 200, { label: result });
  }

  return json(res, 404, { error: 'Unknown action' });
}
