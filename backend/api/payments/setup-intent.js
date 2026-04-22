import Stripe from 'stripe';
import { getDb } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { json, handleCors } from '../../lib/http.js';
import { getStripeSecretKey } from '../../lib/stripeCredentials.js';
import { ensureStripeCustomer } from '../../lib/stripeCustomer.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();
  try {
    const sk = await getStripeSecretKey(sql);
    if (!sk) return json(res, 503, { error: 'Payments are not configured.' });
    const stripe = new Stripe(sk);

    const customer = await ensureStripeCustomer(sql, { userId: auth.userId });
    const si = await stripe.setupIntents.create({
      customer,
      payment_method_types: ['card'],
      usage: 'off_session',
    });
    return json(res, 200, { clientSecret: si.client_secret });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Request failed' });
  }
}

