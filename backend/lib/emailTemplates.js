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
