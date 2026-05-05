import { optionalUser } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { getDb } from '../../lib/db.js';
import {
  buildStripeOrderPaymentContext,
  getStripeForPaymentIntent,
  getStripeCustomerIdForUser,
} from '../../lib/stripeOrderPaymentContext.js';

/**
 * Resolves a trusted storefront origin for success/cancel URLs.
 * Prefers the request Origin (browser) when the client also sends a matching returnBase.
 */
function resolveReturnBase(req, returnBaseFromBody) {
  const headerOrigin = req.headers?.origin || req.headers?.Origin;
  const trimmed = (returnBaseFromBody && String(returnBaseFromBody).trim().replace(/\/+$/, '')) || '';
  if (trimmed && headerOrigin && trimmed === headerOrigin) {
    return trimmed;
  }
  if (headerOrigin && /^https?:\/\//.test(String(headerOrigin))) {
    return String(headerOrigin).replace(/\/+$/, '');
  }
  const env = String(process.env.STRIPE_CHECKOUT_SUCCESS_BASE || process.env.NEXT_PUBLIC_SITE_URL || '').replace(
    /\/+$/,
    '',
  );
  if (env && /^https?:\/\//.test(env)) {
    return env;
  }
  return null;
}

async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const auth = optionalUser(req);

  try {
    const sql = getDb();
    const body = await readJson(req);
    const returnBase = resolveReturnBase(req, body.returnBase);

    if (!returnBase) {
      return json(res, 400, {
        error:
          'Could not determine storefront URL. Open checkout from the shop site, or set STRIPE_CHECKOUT_SUCCESS_BASE on the API.',
      });
    }

    const prepared = await buildStripeOrderPaymentContext(sql, body, auth);
    if (prepared.error) {
      return json(res, prepared.error.status, { error: prepared.error.message });
    }
    const { finalTotal, metadata, cleanAddr, emailForReceipt, totals } = prepared.value;

    const g = await getStripeForPaymentIntent(sql);
    if (g.error) return json(res, g.error.status, { error: g.error.message });
    const { stripe } = g;

    const customerId = await getStripeCustomerIdForUser(sql, auth.userId);

    const successUrl = `${returnBase}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${returnBase}/checkout?cancelled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: "Heaven's Boutique order",
            },
            unit_amount: finalTotal,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata,
        description: "Heaven's Boutique order",
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
      },
      customer: customerId || undefined,
      customer_email: !auth.userId && emailForReceipt ? emailForReceipt.slice(0, 320) : undefined,
      client_reference_id: auth.userId || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return json(res, 500, { error: 'Stripe did not return a checkout URL.' });
    }

    return json(res, 200, {
      url: session.url,
      amountCents: finalTotal,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      shippingCents: totals.shippingCents,
      taxCents: totals.taxCents,
      giftCardDebitCents: totals.giftCardDebitCents,
    });
  } catch (e) {
    console.error(e);
    return json(res, 400, { error: e.message || 'Checkout session failed' });
  }
}
export default withCorsContext(handler);
