import { sendEmail } from './email.js';

const BRAND = "Heaven's Boutique";
const BRAND_COLOR = '#C9A96E';
const TEXT_COLOR = '#2C2C2C';
const MUTED = '#888888';

function base(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${BRAND}</title>
</head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F5;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="padding:0 0 24px 0;text-align:center;">
          <span style="font-size:22px;font-weight:700;letter-spacing:0.04em;color:${BRAND_COLOR};">${BRAND}</span>
        </td>
      </tr>
      <!-- Body card -->
      <tr>
        <td style="background:#FFFFFF;border-radius:16px;padding:36px 36px 28px;border:1px solid #EEEBE7;">
          ${bodyHtml}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="padding:24px 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:${MUTED};">
            © ${new Date().getFullYear()} ${BRAND} · Questions? Reply to this email or visit our store.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function moneyFmt(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function addrLines(addr) {
  if (!addr) return '';
  const parts = [addr.name, addr.line1, addr.line2, `${addr.city}, ${addr.state || ''} ${addr.postal}`.trim(), addr.country !== 'US' ? addr.country : ''];
  return parts.filter(Boolean).join('<br/>');
}

/**
 * @param {{ to: string, orderId: string, items: Array<{ productName: string, quantity: number, unitPriceCents: number }>, subtotalCents: number, discountCents: number, shippingCents: number, taxCents: number, totalCents: number, shippingAddress: object|null, shippingTier: string|null }} opts
 */
export async function sendOrderConfirmation(opts) {
  const { to, orderId, items = [], subtotalCents, discountCents, shippingCents, taxCents, totalCents, shippingAddress, shippingTier } = opts;
  if (!to) return;

  const shortId = String(orderId).slice(0, 8).toUpperCase();

  const itemRows = items.map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F0EDE9;font-size:14px;color:${TEXT_COLOR};">
        ${it.productName || 'Item'}${it.variantSize ? ` <span style="color:${MUTED};">· ${it.variantSize}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #F0EDE9;text-align:center;font-size:14px;color:${MUTED};">×${it.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #F0EDE9;text-align:right;font-size:14px;color:${TEXT_COLOR};">${moneyFmt(it.unitPriceCents * it.quantity)}</td>
    </tr>`).join('');

  const addrHtml = shippingAddress
    ? `<p style="margin:20px 0 0;font-size:13px;color:${MUTED};">Shipping to</p>
       <p style="margin:4px 0 0;font-size:14px;color:${TEXT_COLOR};line-height:1.6;">${addrLines(shippingAddress)}</p>`
    : '';

  const tierLabel = shippingTier
    ? shippingTier.charAt(0).toUpperCase() + shippingTier.slice(1).replace('_', ' ')
    : 'Standard';

  const html = base(`
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">Order confirmed</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED};">Order #${shortId}</p>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${itemRows}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${discountCents > 0 ? `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${MUTED};">Subtotal</td>
        <td style="padding:6px 0;text-align:right;font-size:13px;color:${TEXT_COLOR};">${moneyFmt(subtotalCents)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${MUTED};">Discount</td>
        <td style="padding:6px 0;text-align:right;font-size:13px;color:#E8826E;">−${moneyFmt(discountCents)}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${MUTED};">Shipping (${tierLabel})</td>
        <td style="padding:6px 0;text-align:right;font-size:13px;color:${TEXT_COLOR};">${shippingCents > 0 ? moneyFmt(shippingCents) : 'Free'}</td>
      </tr>
      ${taxCents > 0 ? `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${MUTED};">Tax</td>
        <td style="padding:6px 0;text-align:right;font-size:13px;color:${TEXT_COLOR};">${moneyFmt(taxCents)}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:14px 0 0;font-size:16px;font-weight:700;color:${TEXT_COLOR};border-top:2px solid #F0EDE9;">Total</td>
        <td style="padding:14px 0 0;text-align:right;font-size:16px;font-weight:700;color:${BRAND_COLOR};border-top:2px solid #F0EDE9;">${moneyFmt(totalCents)}</td>
      </tr>
    </table>

    ${addrHtml}

    <p style="margin:28px 0 0;font-size:14px;color:${MUTED};">
      We'll send you another email with tracking information once your order ships. Thank you for shopping with ${BRAND}!
    </p>
  `);

  await sendEmail({ to, subject: `Order confirmed — #${shortId}`, html });
}

/**
 * @param {{ to: string, orderId: string, trackingNumber: string, carrier: string|null, service: string|null, labelUrl: string|null }}
 */
export async function sendShippingConfirmation({ to, orderId, trackingNumber, carrier, service }) {
  if (!to) return;
  const shortId = String(orderId).slice(0, 8).toUpperCase();
  const carrierLine = [carrier, service].filter(Boolean).join(' ');

  const html = base(`
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">Your order shipped!</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED};">Order #${shortId}</p>

    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_COLOR};">Great news — your Heaven's Boutique order is on its way.</p>

    ${carrierLine ? `<p style="margin:0 0 8px;font-size:13px;color:${MUTED};">Carrier</p>
    <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:${TEXT_COLOR};">${carrierLine}</p>` : ''}

    ${trackingNumber ? `<p style="margin:0 0 8px;font-size:13px;color:${MUTED};">Tracking number</p>
    <p style="margin:0 0 24px;font-size:15px;font-weight:600;font-family:monospace;color:${BRAND_COLOR};">${trackingNumber}</p>` : ''}

    <p style="margin:0;font-size:14px;color:${MUTED};">Open the app anytime to see your shipment status.</p>
  `);

  await sendEmail({ to, subject: `Your order shipped — #${shortId}`, html });
}

/**
 * @param {{ to: string, returnId: string, orderId: string, labelUrl: string, carrier: string|null, trackingCode: string|null }}
 */
export async function sendReturnLabelEmail({ to, returnId, orderId, labelUrl, carrier, trackingCode }) {
  if (!to) return;
  const shortId = String(orderId).slice(0, 8).toUpperCase();

  const html = base(`
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">Return label ready</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED};">Order #${shortId}</p>

    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_COLOR};">Your return has been approved. Print the label below and drop it off at any ${carrier || 'carrier'} location.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td align="center" style="padding:16px 0;">
          <a href="${labelUrl}" style="background:${BRAND_COLOR};color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;display:inline-block;">
            Print return label
          </a>
        </td>
      </tr>
    </table>

    ${trackingCode ? `<p style="margin:0 0 8px;font-size:13px;color:${MUTED};">Return tracking</p>
    <p style="margin:0 0 16px;font-size:15px;font-family:monospace;color:${TEXT_COLOR};">${trackingCode}</p>` : ''}

    <p style="margin:0;font-size:13px;color:${MUTED};">Once we receive your return, we'll process your refund within 3–5 business days.</p>
  `);

  await sendEmail({ to, subject: `Return label for order #${shortId}`, html });
}

/**
 * @param {{ to: string, productName: string, variantSize: string, productUrl?: string|null }} opts
 */
export async function sendBackInStockEmail({ to, productName, variantSize, productUrl = null }) {
  if (!to) return;
  const title = String(productName || 'An item you wanted');
  const size = String(variantSize || '').trim();
  const headline = `${title}${size ? ` (Size ${size})` : ''} is back in stock`;

  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">Back in stock</h1>
    <p style="margin:0 0 18px;font-size:14px;color:${TEXT_COLOR};">${headline}.</p>
    <p style="margin:0 0 22px;font-size:14px;color:${MUTED};">Popular pieces can sell out quickly — grab it while it’s available.</p>
    ${productUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">
      <tr>
        <td align="center" style="padding:8px 0;">
          <a href="${productUrl}" style="background:${BRAND_COLOR};color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;display:inline-block;">
            Shop now
          </a>
        </td>
      </tr>
    </table>` : ''}
  `);

  await sendEmail({ to, subject: `Back in stock: ${title}${size ? ` · ${size}` : ''}`, html });
}

/**
 * Delivers the gift card code by email (self or recipient).
 * @param {{ to: string, code: string, amountCents: number, isGift: boolean, purchaserEmail: string, giftMessage?: string }} opts
 */
export async function sendGiftCardRecipientEmail({
  to,
  code,
  amountCents,
  isGift,
  purchaserEmail,
  giftMessage = '',
}) {
  if (!to) return;
  const amt = moneyFmt(amountCents);
  const noteBlock = giftMessage
    ? `<p style="margin:16px 0 0;font-size:14px;color:${TEXT_COLOR};line-height:1.6;font-style:italic;border-left:3px solid ${BRAND_COLOR};padding-left:14px;">“${String(
        giftMessage,
      )
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')}”</p>`
    : '';
  const fromLine = isGift && purchaserEmail
    ? `<p style="margin:0 0 16px;font-size:14px;color:${MUTED};">A gift from <strong style="color:${TEXT_COLOR};">${String(purchaserEmail).replace(/</g, '&lt;')}</strong></p>`
    : '';

  const html = base(`
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:${TEXT_COLOR};">Your ${BRAND} gift card</h1>
    <p style="margin:0 0 20px;font-size:15px;color:${TEXT_COLOR};">Value: <strong style="color:${BRAND_COLOR};font-size:18px;">${amt}</strong></p>
    ${fromLine}
    ${noteBlock}
    <p style="margin:20px 0 10px;font-size:12px;letter-spacing:0.14em;color:${MUTED};text-transform:uppercase;">Card number</p>
    <p style="margin:0;padding:18px 20px;background:#F8F5F0;border-radius:12px;border:2px dashed #D4C4A8;font-size:18px;font-weight:700;font-family:ui-monospace,Menlo,monospace;letter-spacing:0.06em;color:${TEXT_COLOR};text-align:center;">${String(
      code,
    )
      .replace(/</g, '')
      .replace(/>/g, '')}</p>
    <p style="margin:22px 0 0;font-size:14px;color:${MUTED};">
      Redeem at checkout on our website or in the Heaven’s Boutique app — enter this code in the gift card field.
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:${MUTED};">
      Treat this code like cash. Don’t share it publicly.
    </p>
  `);

  const subj = isGift ? `You received a ${amt} gift card — ${BRAND}` : `Your ${amt} gift card — ${BRAND}`;
  await sendEmail({ to, subject: subj, html });
}

/**
 * Purchaser receipt when the code was emailed to someone else.
 * @param {{ to: string, amountCents: number, recipientEmail: string }} opts
 */
export async function sendGiftCardPurchaserConfirmation({ to, amountCents, recipientEmail }) {
  if (!to) return;
  const amt = moneyFmt(amountCents);
  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">Gift card purchase confirmed</h1>
    <p style="margin:0 0 16px;font-size:14px;color:${TEXT_COLOR};">
      Thank you — we charged ${amt} and emailed the gift card code to:
    </p>
    <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:${BRAND_COLOR};">${String(recipientEmail).replace(/</g, '&lt;')}</p>
    <p style="margin:0;font-size:14px;color:${MUTED};">
      For security, the full code is only sent to that address. Keep your receipt for your records.
    </p>
  `);

  await sendEmail({ to, subject: `Gift card receipt — ${amt}`, html });
}

/**
 * Replacement code after admin reissue — previous code no longer redeems.
 * @param {{ to: string, code: string, balanceCents: number }} opts
 */
export async function sendGiftCardReplacementEmail({ to, code, balanceCents }) {
  if (!to) return;
  const amt = moneyFmt(balanceCents);
  const html = base(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">Replacement gift card code</h1>
    <p style="margin:0 0 14px;font-size:14px;color:${TEXT_COLOR};">
      Your previous gift card code <strong style="color:${TEXT_COLOR};">no longer works</strong> — use this new code instead.
      Remaining balance: <strong style="color:${BRAND_COLOR};">${amt}</strong>
    </p>
    <p style="margin:16px 0 10px;font-size:12px;letter-spacing:0.14em;color:${MUTED};text-transform:uppercase;">New card number</p>
    <p style="margin:0;padding:18px 20px;background:#F8F5F0;border-radius:12px;border:2px dashed #D4C4A8;font-size:18px;font-weight:700;font-family:ui-monospace,Menlo,monospace;letter-spacing:0.06em;color:${TEXT_COLOR};text-align:center;">${String(
      code,
    )
      .replace(/</g, '')
      .replace(/>/g, '')}</p>
    <p style="margin:22px 0 0;font-size:14px;color:${MUTED};">
      Redeem at checkout on our website or in the Heaven’s Boutique app — enter this code in the gift card field.
    </p>
  `);

  await sendEmail({ to, subject: `Your replacement gift card code — ${BRAND}`, html });
}
