import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { mapProduct } from '../../lib/productsMap.js';
import { validateProductProfit } from '../../lib/productProfit.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const category = url.searchParams.get('category');
      const featured = url.searchParams.get('featured');
      const shopLook = url.searchParams.get('shopLook');
      const q = url.searchParams.get('q');
      const size = url.searchParams.get('size');
      const minPrice = url.searchParams.get('minPrice');
      const maxPrice = url.searchParams.get('maxPrice');
      const sort = url.searchParams.get('sort'); // newest | price_asc | price_desc

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

      // Apply search + filters in memory (sufficient for boutique-scale catalogs).
      const qNorm = q ? String(q).trim().toLowerCase() : '';
      const sizeNorm = size ? String(size).trim().toLowerCase() : '';
      const min = minPrice != null && String(minPrice).trim() !== '' ? Number(minPrice) : null;
      const max = maxPrice != null && String(maxPrice).trim() !== '' ? Number(maxPrice) : null;

      let mapped = products.map((p) => mapProduct(p, byProduct[p.id], { includeCost: false }));

      if (qNorm) {
        mapped = mapped.filter((p) => {
          const hay = `${p.name || ''} ${p.description || ''} ${p.category || ''}`.toLowerCase();
          return hay.includes(qNorm);
        });
      }
      if (sizeNorm) {
        mapped = mapped.filter((p) => (p.variants || []).some((v) => String(v.size || '').toLowerCase() === sizeNorm));
      }
      if (min != null && Number.isFinite(min)) {
        mapped = mapped.filter((p) => (p.salePriceCents ?? p.priceCents) >= min);
      }
      if (max != null && Number.isFinite(max)) {
        mapped = mapped.filter((p) => (p.salePriceCents ?? p.priceCents) <= max);
      }

      const sortKey = (sort || 'newest').toLowerCase();
      if (sortKey === 'price_asc') {
        mapped.sort((a, b) => (a.salePriceCents ?? a.priceCents) - (b.salePriceCents ?? b.priceCents));
      } else if (sortKey === 'price_desc') {
        mapped.sort((a, b) => (b.salePriceCents ?? b.priceCents) - (a.salePriceCents ?? a.priceCents));
      } else {
        // already newest from DB
      }

      return json(res, 200, {
        products: mapped,
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
      const costCents =
        body.costCents !== undefined && body.costCents !== null ? Number(body.costCents) : null;
      const supplierName =
        body.supplierName != null && String(body.supplierName).trim() !== ''
          ? String(body.supplierName).trim().slice(0, 200)
          : null;
      const supplierUrl =
        body.supplierUrl != null && String(body.supplierUrl).trim() !== ''
          ? String(body.supplierUrl).trim().slice(0, 2000)
          : null;
      const supplierNotes =
        body.supplierNotes != null && String(body.supplierNotes).trim() !== ''
          ? String(body.supplierNotes).trim().slice(0, 4000)
          : null;

      if (!name || !Number.isFinite(priceCents) || priceCents < 0) {
        return json(res, 400, { error: 'Invalid product data' });
      }
      if (costCents != null && (!Number.isFinite(costCents) || costCents < 0)) {
        return json(res, 400, { error: 'Invalid cost' });
      }
      const profitCheck = validateProductProfit({ priceCents, salePriceCents, costCents });
      if (!profitCheck.ok) return json(res, 400, { error: profitCheck.error });

      const inserted = await sql`
        INSERT INTO products (
          name,
          slug,
          description,
          category,
          price_cents,
          sale_price_cents,
          cost_cents,
          is_featured,
          shop_look_group,
          cloudinary_ids,
          supplier_name,
          supplier_url,
          supplier_notes
        )
        VALUES (
          ${name},
          ${slug},
          ${description},
          ${category},
          ${priceCents},
          ${salePriceCents},
          ${costCents},
          ${isFeatured},
          ${shopLookGroup},
          ${cloudinaryIds},
          ${supplierName},
          ${supplierUrl},
          ${supplierNotes}
        )
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
      return json(res, 201, { product: mapProduct(p, vars, { includeCost: true }) });
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
