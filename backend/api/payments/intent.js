import Stripe from 'stripe';
import { getDb } from '../../lib/db.js';
import { optionalUser } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { buildOrderTotals } from '../../lib/stripeOrder.js';
import { getStripeSecretKey } from '../../lib/stripeCredentials.js';
import { ensureStripeCustomer } from '../../lib/stripeCustomer.js';
import { hashGiftCardCode, normalizeGiftCardCode } from '../../lib/giftCard.js';

// Shipping tier costs in cents — configurable via Vercel env vars
function shippingTiers() {
  return {
    standard: Number(process.env.SHIPPING_STANDARD_CENTS) || 895,
    express: Number(process.env.SHIPPING_EXPRESS_CENTS) || 1895,
    priority: Number(process.env.SHIPPING_PRIORITY_CENTS) || 2995,
  };
}

// Tax rate in basis points (e.g. 600 = 6%). Default 0.
function taxRateBps() {
  return Math.max(0, Number(process.env.TAX_RATE_BPS) || 0);
}

function validateAddress(addr) {
  if (!addr || typeof addr !== 'object') return 'A shipping address is required.';
  if (!String(addr.line1 || '').trim()) return 'Street address is required.';
  if (!String(addr.city || '').trim()) return 'City is required.';
  if (!String(addr.postal || '').trim()) return 'ZIP / postal code is required.';
  return null;
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
    const shippingAddress = body.shippingAddress || null;
    const shippingTier = String(body.shippingTier || 'standard').toLowerCase();
    const redeemPointsRaw = body.redeemPoints != null ? Number(body.redeemPoints) : 0;
    const giftCardCodeRaw = body.giftCardCode || body.giftCard || null;

    const addrErr = validateAddress(shippingAddress);
    if (addrErr) return json(res, 400, { error: addrErr });

    const tiers = shippingTiers();
    if (!tiers[shippingTier]) {
      return json(res, 400, { error: `Invalid shipping tier. Choose: ${Object.keys(tiers).join(', ')}` });
    }
    const shippingCents = tiers[shippingTier];

    const totals = await buildOrderTotals(sql, items, promoCode);

    const taxableAmount = Math.max(0, totals.subtotalCents - totals.discountCents);
    const taxCents = Math.floor((taxableAmount * taxRateBps()) / 10000);
    let redeemPoints = 0;
    let redeemCents = 0;
    if (auth.userId && Number.isFinite(redeemPointsRaw) && redeemPointsRaw > 0) {
      const userRows = await sql`SELECT loyalty_points FROM users WHERE id = ${auth.userId} LIMIT 1`;
      const available = Number(userRows[0]?.loyalty_points || 0);
      redeemPoints = Math.max(0, Math.min(available, Math.floor(redeemPointsRaw)));
      // 1 point = 1 cent; cap redemption to 25% of (subtotal - discounts)
      const cap = Math.floor(taxableAmount * 0.25);
      redeemCents = Math.min(cap, redeemPoints);
    }

    let finalTotal = Math.max(0, totals.totalCents + shippingCents + taxCents - redeemCents);

    const MIN_CARD_CENTS = Math.max(0, Number(process.env.CHECKOUT_MIN_CARD_CENTS) || 50);
    let giftCardIdMeta = '';
    let giftCardDebitCents = 0;

    if (giftCardCodeRaw) {
      const normalized = normalizeGiftCardCode(giftCardCodeRaw);
      if (!normalized) {
        return json(res, 400, { error: 'Enter a valid gift card code.' });
      }
      const gh = hashGiftCardCode(normalized);
      const gcRows = await sql`
        SELECT id, balance_cents, active, expires_at
        FROM gift_cards WHERE code_hash = ${gh} LIMIT 1
      `;
      const gc = gcRows[0];
      if (!gc?.active) return json(res, 400, { error: 'Gift card not found or inactive.' });
      if (gc.expires_at && new Date(gc.expires_at) < new Date()) {
        return json(res, 400, { error: 'This gift card has expired.' });
      }
      const bal = Number(gc.balance_cents) || 0;

      let maxGift = 0;
      if (finalTotal <= MIN_CARD_CENTS) {
        maxGift = 0;
      } else {
        maxGift = Math.min(bal, finalTotal - MIN_CARD_CENTS);
      }

      giftCardDebitCents = Math.max(0, Math.floor(maxGift));
      if (giftCardDebitCents > 0) {
        giftCardIdMeta = String(gc.id);
        finalTotal = Math.max(0, finalTotal - giftCardDebitCents);
      }
    }

    const cleanAddr = {
      name: String(shippingAddress.name || '').trim(),
      line1: String(shippingAddress.line1 || '').trim(),
      line2: String(shippingAddress.line2 || '').trim() || null,
      city: String(shippingAddress.city || '').trim(),
      state: String(shippingAddress.state || '').trim() || null,
      postal: String(shippingAddress.postal || '').trim(),
      country: String(shippingAddress.country || 'US').trim(),
    };

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
      shippingCents: String(shippingCents),
      taxCents: String(taxCents),
      redeemPoints: String(redeemPoints),
      redeemCents: String(redeemCents),
      totalCents: String(finalTotal),
      promoId: totals.promoId || '',
      shippingAddress: JSON.stringify(cleanAddr),
      shippingTier,
      giftCardId: giftCardIdMeta,
      giftCardDebitCents: String(giftCardDebitCents),
    };

    let metadata;
    if (auth.userId) {
      metadata = { ...baseMeta, userId: auth.userId };
    } else {
      if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return json(res, 400, { error: 'Guest checkout requires a valid email for your receipt and order updates.' });
      }
      metadata = { ...baseMeta, guestCheckout: 'true', guestEmail: emailRaw.slice(0, 320) };
    }

    const STRIPE_MIN_CHARGE_CENTS = Math.max(50, MIN_CARD_CENTS || 50);
    if (finalTotal <= 0) {
      return json(res, 400, {
        error: 'Nothing left to charge. Adjust promo, points, or gift card.',
      });
    }
    if (finalTotal < STRIPE_MIN_CHARGE_CENTS) {
      return json(res, 400, {
        error: `Card payments require at least $${(STRIPE_MIN_CHARGE_CENTS / 100).toFixed(
          2,
        )}. Reduce gift card/points or add items.`,
      });
    }

    const sk = await getStripeSecretKey(sql);
    if (!sk) {
      return json(res, 503, {
        error: 'Payments are not configured. Add Stripe keys in Vercel env or Admin → Settings.',
      });
    }
    const stripe = new Stripe(sk);
    let customerId;
    if (auth.userId) {
      try {
        customerId = await ensureStripeCustomer(sql, { userId: auth.userId });
      } catch (e) {
        console.error('ensureStripeCustomer', e);
      }
    }
    const pi = await stripe.paymentIntents.create({
      amount: finalTotal,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: emailRaw ? emailRaw.slice(0, 320) : undefined,
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
      shippingCents,
      taxCents,
      giftCardDebitCents,
    });
  } catch (e) {
    console.error(e);
    return json(res, 400, { error: e.message || 'Payment setup failed' });
  }
}
