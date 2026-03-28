import Stripe from 'stripe';
import { getDb } from '../../lib/db.js';
import { optionalUser } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { buildOrderTotals } from '../../lib/stripeOrder.js';

function stripe() {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(k);
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const auth = optionalUser(req);

  try {
    const sql = getDb();
    const body = await readJson(req);
    const items = body.items;
    const promoCode = body.promoCode || null;
    const emailRaw = body.email != null ? String(body.email).trim() : '';

    const totals = await buildOrderTotals(sql, items, promoCode);

    const baseMeta = {
      items: JSON.stringify(
        totals.lines.map((l) => ({
          variantId: l.variantId,
          productId: l.productId,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })),
      ),
      subtotalCents: String(totals.subtotalCents),
      discountCents: String(totals.discountCents),
      totalCents: String(totals.totalCents),
      promoId: totals.promoId || '',
    };

    let metadata;
    if (auth.userId) {
      metadata = {
        ...baseMeta,
        userId: auth.userId,
      };
    } else {
      if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return json(res, 400, { error: 'Guest checkout requires a valid email for your receipt and order updates.' });
      }
      metadata = {
        ...baseMeta,
        guestCheckout: 'true',
        guestEmail: emailRaw.slice(0, 320),
      };
    }

    const pi = await stripe().paymentIntents.create({
      amount: totals.totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: emailRaw ? emailRaw.slice(0, 320) : undefined,
      metadata,
      description: "Heaven's Boutique order",
    });

    return json(res, 200, {
      clientSecret: pi.client_secret,
      amountCents: totals.totalCents,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
    });
  } catch (e) {
    console.error(e);
    return json(res, 400, { error: e.message || 'Payment setup failed' });
  }
}
