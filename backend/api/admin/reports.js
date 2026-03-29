import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const daysRaw = Number(url.searchParams.get('days'));
  const days = Number.isFinite(daysRaw) ? Math.min(365, Math.max(7, Math.floor(daysRaw))) : 30;

  const sql = getDb();

  try {
    const [summaryRow] = await sql`
      SELECT
        COALESCE(SUM(total_cents) FILTER (WHERE status IN ('paid', 'shipped', 'delivered')), 0)::bigint AS gross_sales_cents,
        COALESCE(SUM(total_cents) FILTER (WHERE status = 'refunded'), 0)::bigint AS refunded_cents,
        COALESCE(SUM(discount_cents) FILTER (WHERE status IN ('paid', 'shipped', 'delivered')), 0)::bigint AS discounts_cents,
        COALESCE(SUM(tax_cents) FILTER (WHERE status IN ('paid', 'shipped', 'delivered')), 0)::bigint AS tax_cents,
        COALESCE(SUM(shipping_cents) FILTER (WHERE status IN ('paid', 'shipped', 'delivered')), 0)::bigint AS shipping_cents,
        COUNT(*) FILTER (WHERE status IN ('paid', 'shipped', 'delivered'))::int AS paid_order_count
      FROM orders
    `;

    const gross = toNum(summaryRow?.gross_sales_cents);
    const refunded = toNum(summaryRow?.refunded_cents);
    const paidCount = Number(summaryRow?.paid_order_count) || 0;

    const byStatus = await sql`
      SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total_cents), 0)::bigint AS total_cents
      FROM orders
      GROUP BY status
      ORDER BY status ASC
    `;

    const daily = await sql`
      SELECT
        (created_at AT TIME ZONE 'UTC')::date AS day,
        COUNT(*) FILTER (WHERE status IN ('paid', 'shipped', 'delivered'))::int AS order_count,
        COALESCE(SUM(total_cents) FILTER (WHERE status IN ('paid', 'shipped', 'delivered')), 0)::bigint AS revenue_cents
      FROM orders
      WHERE created_at >= (NOW() AT TIME ZONE 'UTC') - (${days}::int * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return json(res, 200, {
      currency: 'usd',
      asOf: new Date().toISOString(),
      days,
      summary: {
        grossSalesCents: gross,
        refundedCents: refunded,
        netSalesCents: Math.max(0, gross - refunded),
        discountsCents: toNum(summaryRow?.discounts_cents),
        taxCents: toNum(summaryRow?.tax_cents),
        shippingCents: toNum(summaryRow?.shipping_cents),
        paidOrderCount: paidCount,
        averageOrderValueCents: paidCount > 0 ? Math.round(gross / paidCount) : 0,
      },
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: Number(r.count) || 0,
        totalCents: toNum(r.total_cents),
      })),
      daily: daily.map((r) => ({
        date: formatDay(r.day),
        revenueCents: toNum(r.revenue_cents),
        orderCount: Number(r.order_count) || 0,
      })),
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'bigint') return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDay(day) {
  if (!day) return '';
  if (typeof day === 'string') return day.slice(0, 10);
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return String(day);
  return d.toISOString().slice(0, 10);
}
