import { sendPushToToken } from './fcm.js';

const DEFAULT_LOW_STOCK = 5;

export function getLowStockThreshold() {
  const n = Number(process.env.ADMIN_LOW_STOCK_THRESHOLD);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_LOW_STOCK;
  return Math.min(999_999, Math.floor(n));
}

function formatMoneyCents(cents) {
  const c = Number(cents) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
}

/**
 * In-app row + optional FCM for every admin user.
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {{ title: string, body?: string | null, data?: Record<string, string> }} opts
 */
export async function notifyAllAdmins(sql, { title, body = null, data = {} }) {
  const t = String(title || '').trim();
  if (!t) return;
  const bodyText = body != null && String(body).trim() ? String(body).trim() : null;
  const dataObj = data && typeof data === 'object' ? data : {};
  const json = JSON.stringify(dataObj);

  const admins = await sql`SELECT id, fcm_token FROM users WHERE role = ${'admin'}`;
  for (const a of admins) {
    try {
      await sql`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (${a.id}, ${'admin_alert'}, ${t}, ${bodyText}, ${json}::jsonb)
      `;
    } catch (e) {
      console.error('notifyAllAdmins insert', e);
    }
    const tok = a.fcm_token?.trim();
    if (tok) {
      const pushBody = (bodyText || t).slice(0, 240);
      const flatData = { type: 'admin_alert', ...Object.fromEntries(Object.entries(dataObj).map(([k, v]) => [k, String(v)])) };
      try {
        await sendPushToToken({ token: tok, title: t, body: pushBody, data: flatData });
      } catch (e) {
        console.error('notifyAllAdmins push', e);
      }
    }
  }
}

/**
 * After stock decrements, notify admins if any listed variant is at or below threshold.
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {string[]} variantIds
 */
export async function notifyAdminsLowStockForVariants(sql, variantIds) {
  const threshold = getLowStockThreshold();
  const unique = [...new Set((variantIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!unique.length) return;

  const lines = [];
  for (const vid of unique) {
    const rows = await sql`
      SELECT pv.stock, pv.size, p.name
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv.product_id
      WHERE pv.id = ${vid}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) continue;
    if (r.stock <= threshold) {
      lines.push(`${r.name} · ${r.size}: ${r.stock} left`);
    }
  }
  if (!lines.length) return;

  const body =
    lines.slice(0, 8).join('\n') + (lines.length > 8 ? `\n+${lines.length - 8} more` : '');
  await notifyAllAdmins(sql, {
    title: 'Low stock alert',
    body,
    data: { kind: 'low_stock', threshold: String(threshold) },
  });
}

export { formatMoneyCents };
