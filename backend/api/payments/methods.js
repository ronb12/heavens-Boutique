import Stripe from 'stripe';
import { getDb } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { json, handleCors } from '../../lib/http.js';
import { getStripeSecretKey } from '../../lib/stripeCredentials.js';
import { ensureStripeCustomer } from '../../lib/stripeCustomer.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'DELETE') return json(res, 405, { error: 'Method not allowed' });

  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();
  try {
    const sk = await getStripeSecretKey(sql);
    if (!sk) return json(res, 503, { error: 'Payments are not configured.' });
    const stripe = new Stripe(sk);

    const customer = await ensureStripeCustomer(sql, { userId: auth.userId });

    if (req.method === 'GET') {
      const list = await stripe.paymentMethods.list({ customer, type: 'card' });
      return json(res, 200, {
        methods: (list.data || []).map((pm) => ({
          id: pm.id,
          brand: pm.card?.brand || null,
          last4: pm.card?.last4 || null,
          expMonth: pm.card?.exp_month || null,
          expYear: pm.card?.exp_year || null,
        })),
      });
    }

    // DELETE — detach a saved card from the Stripe customer (and remove it from saved methods list).
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

