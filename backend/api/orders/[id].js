import { getDb } from '../../lib/db.js';
import { requireUser, requireStoreAccess, PERM } from '../../lib/auth.js';
import { isAllowedOrderStatus } from '../../lib/orderStatuses.js';
import { sendPushToToken } from '../../lib/fcm.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { sendShippingConfirmation } from '../../lib/emailTemplates.js';

/**
 * @param {{ status: string, statusChanged: boolean, trackingChanged: boolean, trackingNumber: string | null }} p
 */
function orderCustomerNotificationCopy(p) {
  const { status, statusChanged, trackingChanged, trackingNumber } = p;
  const trackingHint = trackingChanged
    ? trackingNumber
      ? ` Tracking: ${trackingNumber}`
      : ' Tracking details were updated.'
    : '';

  if (statusChanged) {
    const map = {
      pending: {
        title: 'Order received',
        body: "We're processing your order." + trackingHint,
        pushTitle: 'Order update',
        pushBody: 'Tap to see your order status.',
      },
      paid: {
        title: 'Payment confirmed',
        body: "We're preparing your order for shipment." + trackingHint,
        pushTitle: 'Order confirmed',
        pushBody: "We're preparing your order.",
      },
      shipped: {
        title: 'On the way',
        body: 'Your package has shipped.' + trackingHint,
        pushTitle: 'Shipped!',
        pushBody: 'Your order is on the way — tap to track.',
      },
      delivered: {
        title: 'Delivered',
        body: 'Your order has been delivered. Thank you!' + trackingHint,
        pushTitle: 'Delivered',
        pushBody: 'Your order arrived — tap for details.',
      },
      cancelled: {
        title: 'Order cancelled',
        body: 'This order is no longer active.',
        pushTitle: 'Order cancelled',
        pushBody: 'Tap for details.',
      },
      refunded: {
        title: 'Refund processed',
        body: 'Your refund has been completed.',
        pushTitle: 'Refund processed',
        pushBody: 'Tap for order details.',
      },
    };
    const row = map[status] || {
      title: 'Order update',
      body: `Your order status is now ${status}.` + trackingHint,
      pushTitle: 'Order update',
      pushBody: 'Tap to view your order.',
    };
    return row;
  }

  if (trackingChanged) {
    return {
      title: 'Tracking updated',
      body: trackingNumber
        ? `Your shipment tracking: ${trackingNumber}`
        : 'Your order has new tracking information — see the app for details.',
      pushTitle: 'Tracking updated',
      pushBody: 'Tap to view tracking and delivery progress.',
    };
  }

  return { title: 'Order update', body: 'Your order was updated.', pushTitle: 'Order update', pushBody: 'Tap to view your order.' };
}

async function handler(req, res) {
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
        const admin = await requireStoreAccess(req, PERM.ORDERS);
        if (admin.error) return json(res, admin.status, { error: admin.error });
      }

      const items = await sql`
        SELECT oi.*, p.name as product_name, pv.size as variant_size
        FROM order_items oi
        INNER JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_variants pv ON pv.id = oi.variant_id
        WHERE oi.order_id = ${id}
      `;
      return json(res, 200, {
        order: {
          id: o.id,
          status: o.status,
          subtotalCents: o.subtotal_cents,
          discountCents: o.discount_cents,
          shippingCents: o.shipping_cents,
          taxCents: o.tax_cents,
          totalCents: o.total_cents,
          trackingNumber: o.tracking_number,
          stripePaymentIntentId: o.stripe_payment_intent_id,
          shippingAddress: o.shipping_address || null,
          shippingTier: o.shipping_tier || null,
          labelUrl: o.label_url || null,
          carrier: o.carrier || null,
          service: o.service || null,
          fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
          supplierOrderStatus: o.supplier_order_status || 'not_needed',
          supplierName: o.supplier_name || null,
          supplierOrderUrl: o.supplier_order_url || null,
          supplierOrderNumber: o.supplier_order_number || null,
          supplierTrackingUrl: o.supplier_tracking_url || null,
          fulfillmentNotes: o.fulfillment_notes || null,
          createdAt: o.created_at,
          items: items.map((i) => ({
            id: i.id,
            productId: i.product_id,
            variantId: i.variant_id,
            quantity: i.quantity,
            unitPriceCents: i.unit_price_cents,
            productName: i.product_name,
            variantSize: i.variant_size || null,
          })),
        },
      });
    }

    if (req.method === 'PATCH') {
      const admin = await requireStoreAccess(req, PERM.ORDERS);
      if (admin.error) return json(res, admin.status, { error: admin.error });

      const body = await readJson(req);
      const status = body.status != null ? String(body.status).trim() : '';
      const trackingNumber = body.trackingNumber;
      const fulfillmentStatusRaw = body.fulfillmentStatus !== undefined ? String(body.fulfillmentStatus || '').trim() : null;
      const supplierOrderStatusRaw =
        body.supplierOrderStatus !== undefined ? String(body.supplierOrderStatus || '').trim() : null;

      if (status) {
        if (!isAllowedOrderStatus(status)) {
          return json(res, 400, { error: 'Invalid status' });
        }
        await sql`UPDATE orders SET status = ${status}, updated_at = now() WHERE id = ${id}`;
      }
      if (trackingNumber !== undefined) {
        await sql`UPDATE orders SET tracking_number = ${trackingNumber || null}, updated_at = now() WHERE id = ${id}`;
      }
      if (fulfillmentStatusRaw !== null) {
        const allowed = new Set(['unfulfilled', 'needs_supplier_order', 'supplier_ordered', 'supplier_shipped', 'label_purchased', 'packed', 'handed_off', 'delivered']);
        const next = fulfillmentStatusRaw || 'unfulfilled';
        if (!allowed.has(next)) {
          return json(res, 400, { error: `Invalid fulfillmentStatus. Allowed: ${[...allowed].join(', ')}` });
        }
        await sql`UPDATE orders SET fulfillment_status = ${next}, updated_at = now() WHERE id = ${id}`;
      }
      if (supplierOrderStatusRaw !== null) {
        const allowed = new Set(['not_needed', 'needs_order', 'ordered', 'supplier_shipped', 'received', 'cancelled']);
        const next = supplierOrderStatusRaw || 'not_needed';
        if (!allowed.has(next)) {
          return json(res, 400, { error: `Invalid supplierOrderStatus. Allowed: ${[...allowed].join(', ')}` });
        }
        await sql`UPDATE orders SET supplier_order_status = ${next}, updated_at = now() WHERE id = ${id}`;
      }
      if (body.supplierName !== undefined) {
        await sql`UPDATE orders SET supplier_name = ${String(body.supplierName || '').trim() || null}, updated_at = now() WHERE id = ${id}`;
      }
      if (body.supplierOrderUrl !== undefined) {
        await sql`UPDATE orders SET supplier_order_url = ${String(body.supplierOrderUrl || '').trim() || null}, updated_at = now() WHERE id = ${id}`;
      }
      if (body.supplierOrderNumber !== undefined) {
        await sql`UPDATE orders SET supplier_order_number = ${String(body.supplierOrderNumber || '').trim() || null}, updated_at = now() WHERE id = ${id}`;
      }
      if (body.supplierTrackingUrl !== undefined) {
        await sql`UPDATE orders SET supplier_tracking_url = ${String(body.supplierTrackingUrl || '').trim() || null}, updated_at = now() WHERE id = ${id}`;
      }
      if (body.fulfillmentNotes !== undefined) {
        await sql`UPDATE orders SET fulfillment_notes = ${String(body.fulfillmentNotes || '').trim() || null}, updated_at = now() WHERE id = ${id}`;
      }

      const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
      const o = rows[0];
      if (!o) return json(res, 404, { error: 'Not found' });

      const statusChanged = Boolean(status);
      const trackingChanged = trackingNumber !== undefined;

      // Send shipping confirmation email when marked shipped
      if (statusChanged && status === 'shipped') {
        try {
          let toEmail = o.guest_email || '';
          if (o.user_id && !toEmail) {
            const userRows = await sql`SELECT email FROM users WHERE id = ${o.user_id} LIMIT 1`;
            toEmail = userRows[0]?.email || '';
          }
          if (toEmail) {
            await sendShippingConfirmation({
              to: toEmail,
              orderId: id,
              trackingNumber: o.tracking_number || trackingNumber || null,
              carrier: o.carrier || null,
              service: o.service || null,
            });
          }
        } catch (emailErr) {
          console.error('shipping confirmation email', emailErr);
        }
      }

      const didUpdate = statusChanged || trackingChanged;
      if (didUpdate && o.user_id) {
        const copy = orderCustomerNotificationCopy({
          status: o.status,
          statusChanged,
          trackingChanged,
          trackingNumber: o.tracking_number,
        });
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (
            ${o.user_id}, 'order', ${copy.title},
            ${copy.body},
            ${JSON.stringify({ orderId: id, status: o.status, trackingNumber: o.tracking_number })}::jsonb
          )
        `;

        const users = await sql`SELECT fcm_token FROM users WHERE id = ${o.user_id} LIMIT 1`;
        const token = users[0]?.fcm_token;
        if (token) {
          await sendPushToToken({
            token,
            title: copy.pushTitle,
            body: copy.pushBody,
            data: { type: 'order', orderId: id, status: o.status },
          });
        }
      }

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
