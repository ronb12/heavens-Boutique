import { randomUUID } from 'node:crypto';
import { getDb } from '../../../lib/db.js';
import { requireAdmin } from '../../../lib/auth.js';
import { isAllowedOrderStatus } from '../../../lib/orderStatuses.js';
import { json, readJson, handleCors } from '../../../lib/http.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const sql = getDb();

  try {
    const body = await readJson(req);
    const userIdRaw = body.userId != null ? String(body.userId).trim() : '';
    const guestEmail = body.guestEmail != null ? String(body.guestEmail).trim().toLowerCase() : '';

    if (userIdRaw && guestEmail) {
      return json(res, 400, { error: 'Provide either userId or guestEmail, not both' });
    }
    if (!userIdRaw && !guestEmail) {
      return json(res, 400, { error: 'userId (registered customer) or guestEmail is required' });
    }
    if (guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return json(res, 400, { error: 'Invalid guestEmail' });
    }

    let userId = null;
    if (userIdRaw) {
      if (!UUID_RE.test(userIdRaw)) {
        return json(res, 400, { error: 'Invalid userId' });
      }
      const u = await sql`SELECT id FROM users WHERE id = ${userIdRaw} LIMIT 1`;
      if (!u[0]) return json(res, 404, { error: 'Customer not found' });
      userId = userIdRaw;
    }

    const status = String(body.status || 'pending').trim();
    if (!isAllowedOrderStatus(status)) {
      return json(res, 400, { error: 'Invalid status' });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return json(res, 400, { error: 'At least one line item is required' });
    }

    const normalized = [];
    for (const raw of items) {
      const productId = String(raw.productId || '').trim();
      const variantId = String(raw.variantId || '').trim();
      const quantity = Number(raw.quantity);
      let unitPriceCents = Number(raw.unitPriceCents);
      if (!UUID_RE.test(productId) || !UUID_RE.test(variantId)) {
        return json(res, 400, { error: 'Each item needs valid productId and variantId' });
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
        return json(res, 400, { error: 'Each item needs quantity between 1 and 999' });
      }
      if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0 || unitPriceCents > 99_999_999) {
        return json(res, 400, { error: 'Each item needs a valid unitPriceCents' });
      }
      unitPriceCents = Math.round(unitPriceCents);
      normalized.push({ productId, variantId, quantity, unitPriceCents });
    }

    const discountCents = Math.max(0, Math.round(Number(body.discountCents) || 0));
    const taxCents = Math.max(0, Math.round(Number(body.taxCents) || 0));
    const shippingCents = Math.max(0, Math.round(Number(body.shippingCents) || 0));
    const decrementStock = body.decrementStock !== false;

    let subtotalCents = 0;
    for (const line of normalized) {
      subtotalCents += line.unitPriceCents * line.quantity;
    }
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents + shippingCents);

    for (const line of normalized) {
      const rows = await sql`
        SELECT pv.id, pv.product_id, pv.stock
        FROM product_variants pv
        WHERE pv.id = ${line.variantId}
        LIMIT 1
      `;
      const v = rows[0];
      if (!v || v.product_id !== line.productId) {
        return json(res, 400, { error: `Variant ${line.variantId} does not belong to product ${line.productId}` });
      }
    }

    const byVariant = new Map();
    for (const line of normalized) {
      byVariant.set(line.variantId, (byVariant.get(line.variantId) || 0) + line.quantity);
    }
    if (decrementStock && ['paid', 'shipped', 'delivered'].includes(status)) {
      for (const [vid, need] of byVariant) {
        const rows = await sql`SELECT stock FROM product_variants WHERE id = ${vid} LIMIT 1`;
        if (!rows[0] || rows[0].stock < need) {
          return json(res, 400, { error: `Insufficient stock for variant ${vid}` });
        }
      }
    }

    const shipJson =
      body.shippingAddress != null && typeof body.shippingAddress === 'object'
        ? JSON.stringify(body.shippingAddress)
        : '{}';

    const orderId = randomUUID();
    const stripeId =
      body.stripePaymentIntentId != null && String(body.stripePaymentIntentId).trim()
        ? String(body.stripePaymentIntentId).trim()
        : null;

    const queries = [
      sql`
        INSERT INTO orders (
          id, user_id, guest_email, status, subtotal_cents, discount_cents, tax_cents, shipping_cents,
          total_cents, currency, stripe_payment_intent_id, shipping_address
        ) VALUES (
          ${orderId},
          ${userId},
          ${userId ? null : guestEmail},
          ${status},
          ${subtotalCents},
          ${discountCents},
          ${taxCents},
          ${shippingCents},
          ${totalCents},
          ${'usd'},
          ${stripeId},
          ${shipJson}::jsonb
        )
      `,
    ];

    for (const line of normalized) {
      queries.push(sql`
        INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents)
        VALUES (${orderId}, ${line.productId}, ${line.variantId}, ${line.quantity}, ${line.unitPriceCents})
      `);
      if (decrementStock && ['paid', 'shipped', 'delivered'].includes(status)) {
        queries.push(sql`
          UPDATE product_variants
          SET stock = stock - ${line.quantity}
          WHERE id = ${line.variantId} AND stock >= ${line.quantity}
        `);
      }
    }

    await sql.transaction(queries);

    if (userId && ['paid', 'shipped', 'delivered'].includes(status)) {
      try {
        const pts = Math.floor(totalCents / 100);
        if (pts > 0) {
          await sql`
            UPDATE users SET loyalty_points = loyalty_points + ${pts}, updated_at = now()
            WHERE id = ${userId}
          `;
          await sql`
            INSERT INTO loyalty_ledger (user_id, delta, reason, order_id)
            VALUES (${userId}, ${pts}, ${'Manual order (admin)'}, ${orderId})
          `;
        }
      } catch (loyErr) {
        console.error('manual order loyalty ledger', loyErr);
      }
    }

    return json(res, 201, { orderId });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
