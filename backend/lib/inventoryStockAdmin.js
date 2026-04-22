import { notifyBackInStock } from './backInStock.js';
import { notifyAdminsLowStockForVariants, getLowStockThreshold } from './adminNotify.js';

/**
 * Admin-only stock adjustment with audit + alerts (matches PATCH /products/:id variant updates).
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {{ userId: string }} auth requireAdmin result
 * @param {{ productId: string; variantId: string; stock: number }} opts
 */
export async function applyAdminVariantStockOnly(sql, auth, { productId, variantId, stock }) {
  const pid = String(productId || '').trim();
  const vid = String(variantId || '').trim();
  if (!pid || !vid) {
    const e = new Error('Missing productId or variantId');
    e.code = 'BAD_INPUT';
    throw e;
  }

  const nextStock = Math.max(0, Math.floor(Number(stock) || 0));

  const prevRows = await sql`
    SELECT pv.stock, pv.size, p.name AS product_name
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.id = ${vid} AND pv.product_id = ${pid}
    LIMIT 1
  `;
  if (!prevRows[0]) {
    const e = new Error('Variant not found for this product');
    e.code = 'NOT_FOUND';
    throw e;
  }

  const prevStock = Number(prevRows[0].stock ?? 0);
  const prevSize = String(prevRows[0].size ?? '');
  const productName = String(prevRows[0].product_name ?? '');

  await sql`
    UPDATE product_variants SET stock = ${nextStock}
    WHERE id = ${vid} AND product_id = ${pid}
  `;

  const delta = nextStock - prevStock;
  if (delta !== 0) {
    try {
      await sql`
        INSERT INTO inventory_audit (variant_id, delta, reason, actor_user_id, meta)
        VALUES (
          ${vid},
          ${delta},
          ${'inventory'},
          ${auth.userId},
          ${JSON.stringify({ productId: pid })}::jsonb
        )
      `;
    } catch (e) {
      if (e?.code !== '42P01') console.error('inventory_audit (inventory)', e);
    }
  }

  if (prevStock <= 0 && nextStock > 0) {
    try {
      await notifyBackInStock(sql, {
        variantId: vid,
        productId: pid,
        productName,
        size: prevSize,
      });
    } catch (e) {
      console.error('notifyBackInStock', e);
    }
  }

  try {
    const threshold = getLowStockThreshold();
    if (prevStock > threshold && nextStock <= threshold) {
      await notifyAdminsLowStockForVariants(sql, [vid]);
    }
  } catch (e) {
    console.error('notifyAdminsLowStockForVariants', e);
  }

  return { variantId: vid, productId: pid, stock: nextStock };
}
