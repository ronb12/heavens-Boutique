import { requireUser } from '../../lib/auth.js';
import { json, handleCors, withCorsContext } from '../../lib/http.js';

/**
 * We do not use SetupIntents to attach reusable cards to the Stripe customer.
 * Card details are entered only in Stripe Checkout or on PaymentIntents at purchase time.
 */
async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  return json(res, 410, {
    error: 'Saved payment methods are not available. Add your card when you check out on Stripe’s payment page.',
    code: 'SAVED_PAYMENT_METHODS_DISABLED',
  });
}
export default withCorsContext(handler);
