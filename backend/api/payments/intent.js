import { optionalUser } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { getDb } from '../../lib/db.js';
import {
  buildStripeOrderPaymentContext,
  getStripeForPaymentIntent,
  getStripeCustomerIdForUser,
} from '../../lib/stripeOrderPaymentContext.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const auth = optionalUser(req);

  try {
    const sql = getDb();
    const body = await readJson(req);
    const prepared = await buildStripeOrderPaymentContext(sql, body, auth);
    if (prepared.error) {
      return json(res, prepared.error.status, { error: prepared.error.message });
    }
    const { finalTotal, metadata, cleanAddr, emailForReceipt, totals } = prepared.value;

    const g = await getStripeForPaymentIntent(sql);
    if (g.error) return json(res, g.error.status, { error: g.error.message });
    const { stripe } = g;

    const customerId = await getStripeCustomerIdForUser(sql, auth.userId);
    const pi = await stripe.paymentIntents.create({
      amount: finalTotal,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: emailForReceipt ? emailForReceipt.slice(0, 320) : undefined,
      metadata,
      description: "Heaven's Boutique order",
      customer: customerId || undefined,
      shipping: {
        name: cleanAddr.name || 'Customer',
        address: {
          line1: cleanAddr.line1,
          line2: cleanAddr.line2 || undefined,
          city: cleanAddr.city,
          state: cleanAddr.state || undefined,
          postal_code: cleanAddr.postal,
          country: cleanAddr.country,
        },
      },
    });

    return json(res, 200, {
      clientSecret: pi.client_secret,
      amountCents: finalTotal,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      shippingCents: totals.shippingCents,
      taxCents: totals.taxCents,
      giftCardDebitCents: totals.giftCardDebitCents,
    });
  } catch (e) {
    console.error(e);
    return json(res, 400, { error: e.message || 'Payment setup failed' });
  }
}
export default withCorsContext(handler);
