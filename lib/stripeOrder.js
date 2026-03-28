import { getDb } from './db.js';

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {{ variantId: string, quantity: number }[]} items
 * @param {string | null} promoCode
 */
export async function buildOrderTotals(sql, items, promoCode) {
  if (!items?.length) throw new Error('Cart is empty');

  const lines = [];
  let subtotal = 0;

  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity) || 1);
    const vr = await sql`
      SELECT v.id, v.stock, v.size, p.id as product_id, p.name, p.price_cents, p.sale_price_cents
      FROM product_variants v
      INNER JOIN products p ON p.id = v.product_id
      WHERE v.id = ${it.variantId}
      LIMIT 1
    `;
    const row = vr[0];
    if (!row) throw new Error(`Variant not found: ${it.variantId}`);
    if (row.stock < qty) throw new Error(`Insufficient stock for ${row.name} (${row.size})`);

    const unit = row.sale_price_cents != null ? row.sale_price_cents : row.price_cents;
    subtotal += unit * qty;
    lines.push({
      variantId: row.id,
      productId: row.product_id,
      quantity: qty,
      unitPriceCents: unit,
      name: row.name,
      size: row.size,
    });
  }

  let discountCents = 0;
  let promoId = null;
  if (promoCode) {
    const code = String(promoCode).trim().toUpperCase();
    const promos = await sql`
      SELECT * FROM promo_codes
      WHERE UPPER(code) = ${code} AND active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (max_uses IS NULL OR uses_count < max_uses)
      LIMIT 1
    `;
    const p = promos[0];
    if (p) {
      promoId = p.id;
      if (p.discount_type === 'percent') {
        discountCents = Math.floor((subtotal * p.discount_value) / 100);
      } else {
        discountCents = Math.min(subtotal, p.discount_value);
      }
    }
  }

  const totalCents = Math.max(0, subtotal - discountCents);
  return { lines, subtotalCents: subtotal, discountCents, totalCents, promoId };
}
