import Stripe from 'stripe';
import { getDb } from '../../lib/db.js';
import { optionalUser } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { getStripeSecretKey } from '../../lib/stripeCredentials.js';
import { ensureStripeCustomer } from '../../lib/stripeCustomer.js';
import { isGiftCardPurchaseEnabled } from '../../lib/storeSettings.js';

function bounds() {
  const min = Math.max(500, Number(process.env.GIFT_CARD_MIN_CENTS) || 1000); // default $10
  const max = Math.min(5000000, Number(process.env.GIFT_CARD_MAX_CENTS) || 50000); // default $500 face value
  return { min, max };
}

async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body = {};
  try {
    body = await readJson(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON' });
  }

  const auth = optionalUser(req);
  const sql = getDb();

  if (!(await isGiftCardPurchaseEnabled(sql))) {
    return json(res, 403, {
      error: 'Gift card purchases are temporarily unavailable.',
    });
  }

  const { min: MIN_CENTS, max: MAX_CENTS } = bounds();

  let amountCents = Math.round(Number(body.amountCents));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    const dollars = Number(body.amountDollars);
    if (Number.isFinite(dollars) && dollars > 0) amountCents = Math.round(dollars * 100);
  }

  if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return json(res, 400, {
      error: `Choose an amount between $${(MIN_CENTS / 100).toFixed(2)} and $${(MAX_CENTS / 100).toFixed(2)}.`,
    });
  }

  const sendAsGift = Boolean(body.sendAsGift);
  const message = String(body.message || '').trim().slice(0, 500);
  let recipientEmail = String(body.recipientEmail || '').trim().toLowerCase();
  let purchaserEmail = String(body.purchaserEmail || body.email || '').trim().toLowerCase();

  if (auth.userId) {
    const rows = await sql`SELECT email FROM users WHERE id = ${auth.userId} LIMIT 1`;
    const acct = rows[0]?.email && String(rows[0].email).trim().toLowerCase();
    if (acct) purchaserEmail = acct;
  }

  const okEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  if (!okEmail(purchaserEmail)) {
    return json(res, 400, { error: 'Enter the email address for your receipt.' });
  }

  let giftDeliveryEmail = purchaserEmail;
  if (sendAsGift) {
    if (!okEmail(recipientEmail)) {
      return json(res, 400, { error: 'Enter the recipient email where we should deliver the gift card.' });
    }
    giftDeliveryEmail = recipientEmail;
  }

  const metadata = {
    kind: 'gift_card_purchase',
    amountCents: String(amountCents),
    giftDeliveryEmail,
    giftPurchaserEmail: purchaserEmail,
    isGift: sendAsGift ? '1' : '0',
    giftMessage: message.slice(0, 400),
  };

  if (auth.userId) metadata.userId = auth.userId;
  else metadata.guestCheckout = 'true';

  if (!auth.userId) metadata.guestEmail = purchaserEmail;

  const sk = await getStripeSecretKey(sql);
  if (!sk) {
    return json(res, 503, {
      error: 'Payments are not configured. Add Stripe keys in Admin → Settings.',
    });
  }

  const stripe = new Stripe(sk);

  let customerId;
  if (auth.userId) {
    try {
      customerId = await ensureStripeCustomer(sql, { userId: auth.userId });
    } catch (e) {
      console.error('ensureStripeCustomer (gift card)', e);
    }
  }

  /**
   * Optional: route 100% of gift-card sale proceeds to a Stripe Connect account so they
   * never land on the platform balance (reduces accidental use for inventory / payouts).
   * Set STRIPE_GIFT_CARD_CONNECT_ACCOUNT_ID=acct_... (Express or Standard connected account).
   * Redemption still uses Postgres `gift_cards.balance_cents` + checkout PI metadata as today.
   */
  const connectDest = process.env.STRIPE_GIFT_CARD_CONNECT_ACCOUNT_ID?.trim() || '';
  const useGiftCardConnect = /^acct_[a-zA-Z0-9]+$/.test(connectDest);

  const piParams = {
    amount: amountCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    receipt_email: purchaserEmail.slice(0, 320),
    metadata,
    description: "Heaven's Boutique gift card purchase",
    customer: customerId || undefined,
  };
  if (useGiftCardConnect) {
    piParams.transfer_data = { destination: connectDest };
  }

  const pi = await stripe.paymentIntents.create(piParams);

  return json(res, 200, {
    clientSecret: pi.client_secret,
    amountCents,
    publishableKeyNeeded: true,
  });
}
export default withCorsContext(handler);
