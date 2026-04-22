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
import { sendOrderConfirmation } from '../../lib/emailTemplates.js';

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
    const shippingCents = Number(pi.metadata.shippingCents) || 0;
    const taxCents = Number(pi.metadata.taxCents) || 0;
    const redeemPoints = Number(pi.metadata.redeemPoints) || 0;
    const redeemCents = Number(pi.metadata.redeemCents) || 0;
    const total = Number(pi.metadata.totalCents) || pi.amount;
    const shippingTier = pi.metadata.shippingTier || null;
    const rawPromo = pi.metadata.promoId;
    const promoId = rawPromo && /^[0-9a-f-]{36}$/i.test(String(rawPromo)) ? String(rawPromo) : null;
    const rawGiftCard = pi.metadata?.giftCardId;
    const giftCardId =
      rawGiftCard && /^[0-9a-f-]{36}$/i.test(String(rawGiftCard)) ? String(rawGiftCard) : null;
    const giftCardDebitCents = Number(pi.metadata?.giftCardDebitCents) || 0;

    let shippingAddress = null;
    try {
      if (pi.metadata.shippingAddress) {
        shippingAddress = JSON.parse(pi.metadata.shippingAddress);
      }
    } catch {
      /* ignore malformed address */
    }

    try {
      const orders = userId
        ? await sql`
            INSERT INTO orders (
              user_id, guest_email, status, subtotal_cents, discount_cents,
              shipping_cents, tax_cents, total_cents,
              stripe_payment_intent_id, promo_code_id, shipping_address, shipping_tier,
              gift_card_debit_cents
            )
            VALUES (
              ${userId}, null, 'paid', ${subtotal}, ${discount},
              ${shippingCents}, ${taxCents}, ${total},
              ${pi.id}, ${promoId},
              ${shippingAddress ? JSON.stringify(shippingAddress) : null}::jsonb,
              ${shippingTier},
              ${giftCardDebitCents}
            )
            RETURNING id
          `
        : await sql`
            INSERT INTO orders (
              user_id, guest_email, status, subtotal_cents, discount_cents,
              shipping_cents, tax_cents, total_cents,
              stripe_payment_intent_id, promo_code_id, shipping_address, shipping_tier,
              gift_card_debit_cents
            )
            VALUES (
              null, ${guestEmail}, 'paid', ${subtotal}, ${discount},
              ${shippingCents}, ${taxCents}, ${total},
              ${pi.id}, ${promoId},
              ${shippingAddress ? JSON.stringify(shippingAddress) : null}::jsonb,
              ${shippingTier},
              ${giftCardDebitCents}
            )
            RETURNING id
          `;
      const orderId = orders[0].id;

      if (giftCardId && giftCardDebitCents > 0) {
        try {
          const dup = await sql`
            SELECT 1 FROM gift_card_redemptions WHERE stripe_payment_intent_id = ${pi.id} LIMIT 1
          `;
          if (!dup[0]) {
            const upd = await sql`
              UPDATE gift_cards
              SET balance_cents = balance_cents - ${giftCardDebitCents}, updated_at = now()
              WHERE id = ${giftCardId}
                AND active = true
                AND balance_cents >= ${giftCardDebitCents}
              RETURNING id
            `;
            if (!upd[0]) {
              console.error('Gift card debit failed', { giftCardId, pi: pi.id, giftCardDebitCents });
            } else {
              await sql`
                INSERT INTO gift_card_redemptions (gift_card_id, order_id, stripe_payment_intent_id, amount_cents)
                VALUES (${giftCardId}, ${orderId}, ${pi.id}, ${giftCardDebitCents})
              `;
            }
          }
        } catch (gcErr) {
          if (gcErr?.code !== '42P01') console.error('gift_card_redemptions', gcErr);
        }
      }

      for (const line of parsedItems) {
        await sql`
          INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents)
          VALUES (${orderId}, ${line.productId}, ${line.variantId}, ${line.quantity}, ${line.unitPriceCents})
        `;
        await sql`
          UPDATE product_variants SET stock = stock - ${line.quantity}
          WHERE id = ${line.variantId} AND stock >= ${line.quantity}
        `;
        try {
          await sql`
            INSERT INTO inventory_audit (variant_id, delta, reason, actor_user_id, order_id, meta)
            VALUES (
              ${line.variantId},
              ${-Math.abs(Number(line.quantity) || 0)},
              ${'order_paid'},
              ${userId || null},
              ${orderId},
              ${JSON.stringify({ source: 'stripe_webhook', paymentIntentId: pi.id })}::jsonb
            )
          `;
        } catch (e) {
          // If audit table isn't migrated yet, don't block fulfillment.
          if (e?.code !== '42P01') console.error('inventory_audit (stripe)', e);
        }
      }

      // Fetch product names for email line items
      let emailItems = parsedItems;
      try {
        const variantIds = parsedItems.map((l) => l.variantId);
        const productRows = await sql`
          SELECT pv.id AS variant_id, p.name AS product_name, pv.size AS variant_size
          FROM product_variants pv
          JOIN products p ON p.id = pv.product_id
          WHERE pv.id = ANY(${variantIds})
        `;
        const byVariant = Object.fromEntries(productRows.map((r) => [r.variant_id, r]));
        emailItems = parsedItems.map((l) => ({
          ...l,
          productName: byVariant[l.variantId]?.product_name || 'Item',
          variantSize: byVariant[l.variantId]?.variant_size || null,
        }));
      } catch (lookupErr) {
        console.error('product lookup for email', lookupErr);
      }

      // Send order confirmation email
      try {
        let toEmail = guestEmail || '';
        if (userId && !toEmail) {
          const userRows = await sql`SELECT email FROM users WHERE id = ${userId} LIMIT 1`;
          toEmail = userRows[0]?.email || '';
        }
        if (toEmail) {
          await sendOrderConfirmation({
            to: toEmail,
            orderId,
            items: emailItems,
            subtotalCents: subtotal,
            discountCents: discount,
            shippingCents,
            taxCents,
            totalCents: total,
            shippingAddress,
            shippingTier,
          });
        }
      } catch (emailErr) {
        console.error('order confirmation email', emailErr);
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
        try {
          await sql`
            INSERT INTO promo_redemptions (promo_id, order_id, discount_cents, total_cents)
            VALUES (${promoId}, ${orderId}, ${discount}, ${total})
            ON CONFLICT DO NOTHING
          `;
        } catch (e) {
          if (e?.code !== '42P01') console.error('promo_redemptions', e);
        }
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

        // Redeem points (deduct) if requested
        if (redeemPoints > 0 && redeemCents > 0) {
          try {
            await sql`
              UPDATE users SET loyalty_points = GREATEST(0, loyalty_points - ${redeemPoints}), updated_at = now()
              WHERE id = ${userId}
            `;
            await sql`
              INSERT INTO loyalty_ledger (user_id, delta, reason, order_id)
              VALUES (${userId}, ${-Math.abs(redeemPoints)}, 'redeem', ${orderId})
            `;
          } catch (e) {
            console.error('loyalty redeem', e);
          }
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
