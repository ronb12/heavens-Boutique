import Stripe from 'stripe';
import { getDb } from '../../lib/db.js';
import { optionalUser } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { buildOrderTotals } from '../../lib/stripeOrder.js';
import { getStripeSecretKey } from '../../lib/stripeCredentials.js';

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

    const sk = await getStripeSecretKey(sql);
    if (!sk) {
      return json(res, 503, {
        error: 'Payments are not configured. Add Stripe keys in Vercel env or Admin → Settings.',
      });
    }
    const stripe = new Stripe(sk);
    const pi = await stripe.paymentIntents.create({
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
