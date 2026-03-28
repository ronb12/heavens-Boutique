import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { mapProduct } from '../../lib/productsMap.js';

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
      return json(res, 200, { product: mapProduct(p, vars) });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const auth = requireAdmin(req);
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

      await sql`
        UPDATE products SET
          name = ${name},
          slug = ${slug},
          description = ${description},
          category = ${category},
          price_cents = ${priceCents},
          sale_price_cents = ${salePriceCents},
          is_featured = ${isFeatured},
          shop_look_group = ${shopLookGroup},
          cloudinary_ids = ${cloudinaryIds},
          updated_at = now()
        WHERE id = ${id}
      `;

      if (Array.isArray(body.variants)) {
        for (const v of body.variants) {
          if (v.id) {
            await sql`
              UPDATE product_variants SET size = ${String(v.size)}, sku = ${v.sku || null}, stock = ${Number(v.stock) || 0}
              WHERE id = ${v.id} AND product_id = ${id}
            `;
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
      return json(res, 200, { product: mapProduct(rows[0], vars) });
    }

    if (req.method === 'DELETE') {
      const auth = requireAdmin(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });
      await sql`DELETE FROM products WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
