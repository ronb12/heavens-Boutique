import Stripe from 'stripe';
import { getDb } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { json, handleCors, withCorsContext } from '../../lib/http.js';
import { getStripeSecretKey } from '../../lib/stripeCredentials.js';
import { ensureStripeCustomer } from '../../lib/stripeCustomer.js';

/**
 * We do not surface or add saved cards on the Stripe customer. Card entry happens at
 * checkout (Stripe Checkout / PaymentIntents) only. GET always returns an empty list.
 * DELETE remains so a client with a prior payment method id can detach it (e.g. legacy data).
 */
async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'DELETE') return json(res, 405, { error: 'Method not allowed' });

  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();
  try {
    if (req.method === 'GET') {
      return json(res, 200, { methods: [] });
    }

    const sk = await getStripeSecretKey(sql);
    if (!sk) return json(res, 503, { error: 'Payments are not configured.' });
    const stripe = new Stripe(sk);

    const customer = await ensureStripeCustomer(sql, { userId: auth.userId });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pmId = String(url.searchParams.get('id') || url.searchParams.get('paymentMethodId') || '').trim();
    if (!pmId || !/^pm_[a-zA-Z0-9]+$/.test(pmId)) {
      return json(res, 400, { error: 'Invalid payment method id' });
    }

    const pm = await stripe.paymentMethods.retrieve(pmId);
    if (String(pm.customer || '') !== String(customer)) {
      return json(res, 403, { error: 'Not allowed' });
    }

    await stripe.paymentMethods.detach(pmId);
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Request failed' });
  }
}
export default withCorsContext(handler);
