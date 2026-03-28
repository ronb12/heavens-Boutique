import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { mapProduct } from '../../lib/productsMap.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const category = url.searchParams.get('category');
      const featured = url.searchParams.get('featured');
      const shopLook = url.searchParams.get('shopLook');

      let products;
      let variants;
      if (shopLook) {
        if (shopLook === 'any') {
          products = await sql`
            SELECT * FROM products WHERE shop_look_group IS NOT NULL ORDER BY created_at DESC
          `;
          variants = await sql`
            SELECT v.* FROM product_variants v
            INNER JOIN products p ON p.id = v.product_id
            WHERE p.shop_look_group IS NOT NULL
          `;
        } else {
          products = await sql`
            SELECT * FROM products WHERE shop_look_group = ${shopLook} ORDER BY created_at DESC
          `;
          variants = await sql`
            SELECT v.* FROM product_variants v
            INNER JOIN products p ON p.id = v.product_id
            WHERE p.shop_look_group = ${shopLook}
          `;
        }
      } else if (category) {
        products = await sql`
          SELECT * FROM products WHERE category = ${category} ORDER BY created_at DESC
        `;
        variants = await sql`
          SELECT v.* FROM product_variants v
          INNER JOIN products p ON p.id = v.product_id
          WHERE p.category = ${category}
        `;
      } else if (featured === '1' || featured === 'true') {
        products = await sql`
          SELECT * FROM products WHERE is_featured = true ORDER BY created_at DESC
        `;
        variants = await sql`
          SELECT v.* FROM product_variants v
          INNER JOIN products p ON p.id = v.product_id
          WHERE p.is_featured = true
        `;
      } else {
        products = await sql`SELECT * FROM products ORDER BY created_at DESC`;
        variants = await sql`SELECT * FROM product_variants`;
      }

      if (products.length === 0) return json(res, 200, { products: [] });

      const byProduct = {};
      for (const v of variants) {
        if (!byProduct[v.product_id]) byProduct[v.product_id] = [];
        byProduct[v.product_id].push(v);
      }

      return json(res, 200, {
        products: products.map((p) => mapProduct(p, byProduct[p.id])),
      });
    }

    if (req.method === 'POST') {
      const auth = await requireAdmin(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const body = await readJson(req);
      const name = String(body.name || '').trim();
      const slug = String(body.slug || '').trim().toLowerCase().replace(/\s+/g, '-') || name.toLowerCase().replace(/\s+/g, '-');
      const description = body.description != null ? String(body.description) : null;
      const category = String(body.category || 'general').trim();
      const priceCents = Number(body.priceCents);
      const salePriceCents = body.salePriceCents != null ? Number(body.salePriceCents) : null;
      const isFeatured = Boolean(body.isFeatured);
      const shopLookGroup = body.shopLookGroup ? String(body.shopLookGroup) : null;
      const cloudinaryIds = Array.isArray(body.cloudinaryIds) ? body.cloudinaryIds : [];
      const variantsIn = Array.isArray(body.variants) ? body.variants : [];

      if (!name || !Number.isFinite(priceCents) || priceCents < 0) {
        return json(res, 400, { error: 'Invalid product data' });
      }

      const inserted = await sql`
        INSERT INTO products (name, slug, description, category, price_cents, sale_price_cents, is_featured, shop_look_group, cloudinary_ids)
        VALUES (${name}, ${slug}, ${description}, ${category}, ${priceCents}, ${salePriceCents}, ${isFeatured}, ${shopLookGroup}, ${cloudinaryIds})
        RETURNING *
      `;
      const p = inserted[0];

      for (const v of variantsIn) {
        const size = String(v.size || '').trim();
        const stock = Number(v.stock) || 0;
        if (!size) continue;
        await sql`
          INSERT INTO product_variants (product_id, size, sku, stock)
          VALUES (${p.id}, ${size}, ${v.sku || null}, ${stock})
        `;
      }

      const vars = await sql`SELECT * FROM product_variants WHERE product_id = ${p.id}`;
      return json(res, 201, { product: mapProduct(p, vars) });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e.code === '23505') {
      return json(res, 409, { error: 'Slug already exists' });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
