import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { getLowStockThreshold } from '../../lib/adminNotify.js';
import { applyAdminVariantStockOnly } from '../../lib/inventoryStockAdmin.js';

/**
 * GET /api/admin/inventory — Shopify-style rows: each variant with on-hand qty.
 * Query: q (search name/sku/size), lowStock=1 (at/below threshold only)
 *
 * PATCH /api/admin/inventory — { updates: [{ productId, variantId, stock }] }
 */
export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();
  const threshold = getLowStockThreshold();

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const qNorm = url.searchParams.get('q') ? String(url.searchParams.get('q')).trim().toLowerCase() : '';
      const lowOnly = url.searchParams.get('lowStock') === '1' || url.searchParams.get('lowStock') === 'true';

      const rows = await sql`
        SELECT
          pv.id AS variant_id,
          pv.product_id,
          pv.size,
          pv.sku,
          pv.stock,
          p.name AS product_name,
          p.category AS category
        FROM product_variants pv
        INNER JOIN products p ON p.id = pv.product_id
        ORDER BY p.name ASC NULLS LAST, pv.size ASC NULLS LAST
      `;

      let items = rows.map((r) => ({
        variantId: r.variant_id,
        productId: r.product_id,
        productName: r.product_name,
        category: r.category || null,
        size: r.size || '',
        sku: r.sku || null,
        stock: Number(r.stock ?? 0),
        lowStock: Number(r.stock ?? 0) <= threshold,
      }));

      if (qNorm) {
        items = items.filter((it) => {
          const hay = `${it.productName || ''} ${it.size || ''} ${it.sku || ''} ${it.category || ''}`.toLowerCase();
          return hay.includes(qNorm);
        });
      }
      if (lowOnly) {
        items = items.filter((it) => it.stock <= threshold);
      }

      return json(res, 200, {
        items,
        lowStockThreshold: threshold,
      });
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (!updates.length) {
        return json(res, 400, { error: 'updates array required' });
      }
      const results = [];
      for (const u of updates) {
        const productId = String(u.productId || '').trim();
        const variantId = String(u.variantId || '').trim();
        const stock = u.stock;
        if (!productId || !variantId) continue;
        try {
          await applyAdminVariantStockOnly(sql, admin, {
            productId,
            variantId,
            stock,
          });
          results.push({ variantId, ok: true });
        } catch (e) {
          if (e?.code === 'NOT_FOUND') {
            results.push({ variantId, ok: false, error: 'Not found' });
          } else {
            throw e;
          }
        }
      }
      return json(res, 200, { ok: true, results });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
