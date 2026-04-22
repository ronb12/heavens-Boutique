import { getDb } from '../../lib/db.js';
import { requireAdmin, optionalAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { mapProduct } from '../../lib/productsMap.js';
import { validateProductProfit } from '../../lib/productProfit.js';
import { notifyBackInStock } from '../../lib/backInStock.js';
import { notifyAdminsLowStockForVariants, getLowStockThreshold } from '../../lib/adminNotify.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const id = req.query?.id;
  if (!id) return json(res, 400, { error: 'Missing id' });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
      const p = rows[0];
      if (!p) return json(res, 404, { error: 'Not found' });
      const vars = await sql`SELECT * FROM product_variants WHERE product_id = ${id}`;
      const { isAdmin } = await optionalAdmin(req);
      return json(res, 200, { product: mapProduct(p, vars, { includeCost: isAdmin }) });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const auth = await requireAdmin(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const body = await readJson(req);
      const existing = await sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
      if (!existing[0]) return json(res, 404, { error: 'Not found' });

      const name = body.name != null ? String(body.name).trim() : existing[0].name;
      const slug = body.slug != null ? String(body.slug).trim().toLowerCase() : existing[0].slug;
      const description = body.description !== undefined ? (body.description == null ? null : String(body.description)) : existing[0].description;
      const category = body.category != null ? String(body.category).trim() : existing[0].category;
      const priceCents = body.priceCents != null ? Number(body.priceCents) : existing[0].price_cents;
      const salePriceCents = body.salePriceCents !== undefined ? (body.salePriceCents == null ? null : Number(body.salePriceCents)) : existing[0].sale_price_cents;
      const isFeatured = body.isFeatured != null ? Boolean(body.isFeatured) : existing[0].is_featured;
      const shopLookGroup = body.shopLookGroup !== undefined ? (body.shopLookGroup == null ? null : String(body.shopLookGroup)) : existing[0].shop_look_group;
      const cloudinaryIds = body.cloudinaryIds != null ? (Array.isArray(body.cloudinaryIds) ? body.cloudinaryIds : existing[0].cloudinary_ids) : existing[0].cloudinary_ids;
      const supplierName =
        body.supplierName !== undefined
          ? body.supplierName == null
            ? null
            : String(body.supplierName).trim().slice(0, 200) || null
          : existing[0].supplier_name ?? null;
      const supplierUrl =
        body.supplierUrl !== undefined
          ? body.supplierUrl == null
            ? null
            : String(body.supplierUrl).trim().slice(0, 2000) || null
          : existing[0].supplier_url ?? null;
      const supplierNotes =
        body.supplierNotes !== undefined
          ? body.supplierNotes == null
            ? null
            : String(body.supplierNotes).trim().slice(0, 4000) || null
          : existing[0].supplier_notes ?? null;
      const existingCost =
        existing[0].cost_cents !== undefined && existing[0].cost_cents !== null
          ? Number(existing[0].cost_cents)
          : null;
      const costCents =
        body.costCents !== undefined
          ? body.costCents === null
            ? null
            : Number(body.costCents)
          : existingCost;
      if (costCents != null && (!Number.isFinite(costCents) || costCents < 0)) {
        return json(res, 400, { error: 'Invalid cost' });
      }
      const profitCheck = validateProductProfit({ priceCents, salePriceCents, costCents });
      if (!profitCheck.ok) return json(res, 400, { error: profitCheck.error });

      await sql`
        UPDATE products SET
          name = ${name},
          slug = ${slug},
          description = ${description},
          category = ${category},
          price_cents = ${priceCents},
          sale_price_cents = ${salePriceCents},
          cost_cents = ${costCents},
          is_featured = ${isFeatured},
          shop_look_group = ${shopLookGroup},
          cloudinary_ids = ${cloudinaryIds},
          supplier_name = ${supplierName},
          supplier_url = ${supplierUrl},
          supplier_notes = ${supplierNotes},
          updated_at = now()
        WHERE id = ${id}
      `;

      if (Array.isArray(body.removedVariantIds)) {
        for (const raw of body.removedVariantIds) {
          const vid = String(raw || '').trim();
          if (!vid) continue;
          const refs = await sql`
            SELECT COUNT(*)::int AS c FROM order_items WHERE variant_id = ${vid}
          `;
          if ((refs[0]?.c ?? 0) > 0) {
            return json(res, 409, {
              error:
                'Cannot delete a variant that appears on orders. Set stock to 0 or archive the product instead.',
            });
          }
          await sql`DELETE FROM product_variants WHERE id = ${vid} AND product_id = ${id}`;
        }
      }

      if (Array.isArray(body.variants)) {
        for (const v of body.variants) {
          if (v.id) {
            const prev = await sql`SELECT stock, size FROM product_variants WHERE id = ${v.id} AND product_id = ${id} LIMIT 1`;
            const prevStock = Number(prev[0]?.stock ?? 0);
            const prevSize = String(prev[0]?.size ?? '');
            const nextStock = Number(v.stock) || 0;
            await sql`
              UPDATE product_variants SET size = ${String(v.size)}, sku = ${v.sku || null}, stock = ${nextStock}
              WHERE id = ${v.id} AND product_id = ${id}
            `;

            // Inventory audit
            try {
              const delta = nextStock - prevStock;
              if (delta !== 0) {
                await sql`
                  INSERT INTO inventory_audit (variant_id, delta, reason, actor_user_id, meta)
                  VALUES (
                    ${String(v.id)},
                    ${delta},
                    ${'admin_edit'},
                    ${auth.userId},
                    ${JSON.stringify({ productId: String(id) })}::jsonb
                  )
                `;
              }
            } catch (e) {
              if (e?.code !== '42P01') console.error('inventory_audit (admin_edit)', e);
            }

            // Back-in-stock trigger: 0 -> >0
            if (prevStock <= 0 && nextStock > 0) {
              try {
                await notifyBackInStock(sql, {
                  variantId: String(v.id),
                  productId: String(id),
                  productName: String(name),
                  size: String(v.size || prevSize || ''),
                });
              } catch (e) {
                console.error('notifyBackInStock', e);
              }
            }

            // Low-stock alert (admin): crossing threshold -> at/below threshold
            try {
              const threshold = getLowStockThreshold();
              if (prevStock > threshold && nextStock <= threshold) {
                await notifyAdminsLowStockForVariants(sql, [String(v.id)]);
              }
            } catch (e) {
              console.error('notifyAdminsLowStockForVariants', e);
            }
          } else if (v.size) {
            await sql`
              INSERT INTO product_variants (product_id, size, sku, stock)
              VALUES (${id}, ${String(v.size)}, ${v.sku || null}, ${Number(v.stock) || 0})
            `;
          }
        }
      }

      const rows = await sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
      const vars = await sql`SELECT * FROM product_variants WHERE product_id = ${id}`;
      return json(res, 200, { product: mapProduct(rows[0], vars, { includeCost: true }) });
    }

    if (req.method === 'DELETE') {
      const auth = await requireAdmin(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });
      const orderRefs = await sql`
        SELECT COUNT(*)::int AS c FROM order_items WHERE product_id = ${id}
      `;
      if ((orderRefs[0]?.c ?? 0) > 0) {
        return json(res, 409, {
          error:
            'Cannot delete a product that appears on orders. Unlist it (set stock to 0) or hide it from featured instead.',
        });
      }
      await sql`DELETE FROM products WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
