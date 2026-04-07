import Stripe from 'stripe';
import { getDb } from '../../lib/db.js';
import { json, readRawBody, handleCors } from '../../lib/http.js';
import { sendPushToToken } from '../../lib/fcm.js';
import {
  notifyAllAdmins,
  notifyAdminsLowStockForVariants,
  formatMoneyCents,
} from '../../lib/adminNotify.js';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../lib/stripeCredentials.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  const sql = getDb();
  let whSecret;
  try {
    whSecret = await getStripeWebhookSecret(sql);
  } catch {
    whSecret = '';
  }
  if (!whSecret || !sig) {
    return json(res, 400, { error: 'Webhook not configured' });
  }

  let event;
  try {
    const buf = await readRawBody(req);
    const sk = await getStripeSecretKey(sql);
    const stripe = new Stripe(sk || 'sk_test_'); // API key unused for signature verification
    event = stripe.webhooks.constructEvent(buf, sig, whSecret);
  } catch (err) {
    console.error(err.message);
    return json(res, 400, { error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const userId = pi.metadata?.userId || null;
    const isGuest = pi.metadata?.guestCheckout === 'true';
    const guestEmail =
      (pi.metadata?.guestEmail && String(pi.metadata.guestEmail).trim()) ||
      (pi.receipt_email && String(pi.receipt_email).trim()) ||
      '';

    if (!userId && !isGuest) {
      return json(res, 200, { received: true });
    }
    if (!userId && (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))) {
      console.error('Guest checkout succeeded but email missing', pi.id);
      return json(res, 200, { received: true, skip: 'guest no email' });
    }

    const existing = await sql`
      SELECT id FROM orders WHERE stripe_payment_intent_id = ${pi.id} LIMIT 1
    `;
    if (existing[0]) {
      return json(res, 200, { received: true, duplicate: true });
    }

    let parsedItems;
    try {
      parsedItems = JSON.parse(pi.metadata.items || '[]');
    } catch {
      return json(res, 200, { received: true, skip: 'bad items' });
    }

    const subtotal = Number(pi.metadata.subtotalCents) || pi.amount;
    const discount = Number(pi.metadata.discountCents) || 0;
    const total = Number(pi.metadata.totalCents) || pi.amount;
    const rawPromo = pi.metadata.promoId;
    const promoId = rawPromo && /^[0-9a-f-]{36}$/i.test(String(rawPromo)) ? String(rawPromo) : null;

    try {
      const orders = userId
        ? await sql`
            INSERT INTO orders (
              user_id, guest_email, status, subtotal_cents, discount_cents, total_cents,
              stripe_payment_intent_id, promo_code_id
            )
            VALUES (
              ${userId}, null, 'paid', ${subtotal}, ${discount}, ${total},
              ${pi.id}, ${promoId}
            )
            RETURNING id
          `
        : await sql`
            INSERT INTO orders (
              user_id, guest_email, status, subtotal_cents, discount_cents, total_cents,
              stripe_payment_intent_id, promo_code_id
            )
            VALUES (
              null, ${guestEmail}, 'paid', ${subtotal}, ${discount}, ${total},
              ${pi.id}, ${promoId}
            )
            RETURNING id
          `;
      const orderId = orders[0].id;

      for (const line of parsedItems) {
        await sql`
          INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents)
          VALUES (${orderId}, ${line.productId}, ${line.variantId}, ${line.quantity}, ${line.unitPriceCents})
        `;
        await sql`
          UPDATE product_variants SET stock = stock - ${line.quantity}
          WHERE id = ${line.variantId} AND stock >= ${line.quantity}
        `;
      }

      try {
        await notifyAllAdmins(sql, {
          title: 'New order placed',
          body: userId
            ? `${formatMoneyCents(total)} paid (registered customer).`
            : `${formatMoneyCents(total)} paid — guest ${guestEmail}`,
          data: { kind: 'new_order', orderId: String(orderId) },
        });
        await notifyAdminsLowStockForVariants(
          sql,
          parsedItems.map((l) => l.variantId),
        );
      } catch (alertErr) {
        console.error('admin order alerts (stripe)', alertErr);
      }

      if (promoId) {
        await sql`UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = ${promoId}`;
      }

      if (userId) {
        const pts = Math.floor(total / 100);
        if (pts > 0) {
          await sql`
            UPDATE users SET loyalty_points = loyalty_points + ${pts}, updated_at = now()
            WHERE id = ${userId}
          `;
          await sql`
            INSERT INTO loyalty_ledger (user_id, delta, reason, order_id)
            VALUES (${userId}, ${pts}, 'purchase', ${orderId})
          `;
        }

        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (
            ${userId}, 'order', 'Order confirmed',
            'Thank you — we are preparing your Heaven Boutique order.',
            ${JSON.stringify({ orderId, status: 'paid' })}::jsonb
          )
        `;

        const users = await sql`SELECT fcm_token FROM users WHERE id = ${userId} LIMIT 1`;
        const token = users[0]?.fcm_token;
        if (token) {
          await sendPushToToken({
            token,
            title: 'Order confirmed',
            body: 'Your payment was successful. We will ship soon.',
            data: { type: 'order', orderId, status: 'paid' },
          });
        }
      }
    } catch (e) {
      console.error('Order fulfillment error', e);
    }
  }

  return json(res, 200, { received: true });
}
