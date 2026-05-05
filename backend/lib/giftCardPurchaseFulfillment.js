import { generateGiftCardCode, hashGiftCardCode } from './giftCard.js';
import { encryptGiftCardCodeForStorage } from './giftCardCodeCipher.js';
import {
  sendGiftCardRecipientEmail,
  sendGiftCardPurchaserConfirmation,
} from './emailTemplates.js';

/**
 * Creates a gift_cards row from a succeeded PaymentIntent and sends emails.
 * Idempotent via unique purchased_via_payment_intent_id.
 *
 * @param {*} sql
 * @param {import('stripe').Stripe.PaymentIntent} pi
 */
export async function fulfillGiftCardPurchaseFromPaymentIntent(sql, pi) {
  const dup = await sql`
    SELECT id FROM gift_cards WHERE purchased_via_payment_intent_id = ${pi.id} LIMIT 1
  `;
  if (dup[0]) return { ok: true, duplicate: true };

  const amountCents = Number(pi.metadata?.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < 50) {
    console.error('[gift card purchase] bad amount', pi.id, pi.metadata?.amountCents);
    return { ok: false, reason: 'bad_amount' };
  }
  if (Number(pi.amount) !== amountCents) {
    console.error('[gift card purchase] PI amount mismatch', pi.id, pi.amount, amountCents);
    return { ok: false, reason: 'amount_mismatch' };
  }

  const giftDeliveryEmail = String(pi.metadata?.giftDeliveryEmail || '').trim().toLowerCase();
  const purchaserEmail = String(pi.metadata?.giftPurchaserEmail || '').trim().toLowerCase();
  const isGift = pi.metadata?.isGift === '1';

  let deliveryEmail = giftDeliveryEmail;
  if (!deliveryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail)) {
    deliveryEmail = purchaserEmail;
  }
  if (!deliveryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail)) {
    console.error('[gift card purchase] no delivery email', pi.id);
    return { ok: false, reason: 'no_email' };
  }

  const giftMessage = String(pi.metadata?.giftMessage || '').trim().slice(0, 500);

  let plain = '';
  for (let i = 0; i < 10; i++) {
    const candidate = generateGiftCardCode();
    const h = hashGiftCardCode(candidate);
    const exists = await sql`SELECT 1 FROM gift_cards WHERE code_hash = ${h} LIMIT 1`;
    if (!exists[0]) {
      plain = candidate;
      break;
    }
  }
  if (!plain) return { ok: false, reason: 'code_gen' };

  const internalNote = JSON.stringify({
    source: 'purchase',
    stripePaymentIntentId: pi.id,
    purchaserEmail,
    isGift,
    giftMessage: giftMessage || undefined,
  });

  const codeCipher = encryptGiftCardCodeForStorage(plain);
  if (!codeCipher) {
    console.error('[gift card purchase] encrypt failed', pi.id);
    return { ok: false, reason: 'encrypt_failed' };
  }

  await sql`
    INSERT INTO gift_cards (
      code_hash,
      code_cipher,
      balance_cents,
      recipient_email,
      internal_note,
      purchased_via_payment_intent_id
    )
    VALUES (
      ${hashGiftCardCode(plain)},
      ${codeCipher},
      ${Math.floor(amountCents)},
      ${deliveryEmail},
      ${internalNote},
      ${pi.id}
    )
  `;

  try {
    await sendGiftCardRecipientEmail({
      to: deliveryEmail,
      code: plain,
      amountCents,
      isGift,
      purchaserEmail,
      giftMessage,
    });
  } catch (e) {
    console.error('[gift card purchase] recipient email', e);
  }

  const purchaserGetsSeparate =
    isGift && purchaserEmail && purchaserEmail !== deliveryEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaserEmail);

  if (purchaserGetsSeparate) {
    try {
      await sendGiftCardPurchaserConfirmation({
        to: purchaserEmail,
        amountCents,
        recipientEmail: deliveryEmail,
      });
    } catch (e) {
      console.error('[gift card purchase] purchaser email', e);
    }
  }

  return { ok: true, duplicate: false };
}
