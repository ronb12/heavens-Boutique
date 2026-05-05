import { getDb } from '../../lib/db.js';
import { requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { mapProduct } from '../../lib/productsMap.js';
import { validateProductProfit } from '../../lib/productProfit.js';
import { postgresClientError } from '../../lib/postgresClientError.js';

function centsFromValue(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v).trim().replace(/^\$\s*/, '').replace(/,/g, '');
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function arr(v) {
  if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean);
  if (v == null) return [];
  return String(v)
    .split(/[|\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function mapQueueRow(r) {
  return {
    id: r.id,
    status: r.status,
    supplierName: r.supplier_name,
    supplierUrl: r.supplier_url,
    title: r.title,
    boutiqueName: r.boutique_name,
    category: r.category,
    description: r.description,
    priceCents: r.price_cents,
    salePriceCents: r.sale_price_cents,
    costCents: r.cost_cents,
    imageUrls: r.image_urls || [],
    sizes: r.sizes || [],
    stock: r.stock,
    shipsFrom: r.ships_from,
    deliveryDaysMin: r.delivery_days_min,
    deliveryDaysMax: r.delivery_days_max,
    backupSupplierUrl: r.backup_supplier_url,
    notes: r.notes,
    publishedProductId: r.published_product_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function createProductFromQueue(sql, row) {
  const name = String(row.boutique_name || row.title || '').trim();
  if (!name) throw new Error('Add a boutique product name before publishing.');
  const priceCents = Number(row.price_cents);
  if (!Number.isFinite(priceCents) || priceCents < 0) throw new Error('Add a valid price before publishing.');
  const salePriceCents = row.sale_price_cents != null ? Number(row.sale_price_cents) : null;
  const costCents = row.cost_cents != null ? Number(row.cost_cents) : null;
  const profitCheck = validateProductProfit({ priceCents, salePriceCents, costCents });
  if (!profitCheck.ok) throw new Error(profitCheck.error);

  const baseSlug = slugify(name) || `supplier-item-${Date.now()}`;
  let slug = baseSlug;
  for (let i = 2; i < 50; i++) {
    const found = await sql`SELECT id FROM products WHERE slug = ${slug} LIMIT 1`;
    if (!found[0]) break;
    slug = `${baseSlug}-${i}`;
  }

  const notes = [
    row.notes ? String(row.notes) : '',
    row.ships_from ? `Ships from: ${row.ships_from}` : '',
    row.delivery_days_min || row.delivery_days_max
      ? `Delivery estimate: ${row.delivery_days_min || '?'}-${row.delivery_days_max || '?'} days`
      : '',
    row.backup_supplier_url ? `Backup supplier: ${row.backup_supplier_url}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const inserted = await sql`
    INSERT INTO products (
      name, slug, description, category, price_cents, sale_price_cents, cost_cents,
      is_featured, shop_look_group, cloudinary_ids, supplier_name, supplier_url, supplier_notes
    )
    VALUES (
      ${name},
      ${slug},
      ${row.description || null},
      ${row.category || 'general'},
      ${priceCents},
      ${Number.isFinite(salePriceCents) ? salePriceCents : null},
      ${Number.isFinite(costCents) ? costCents : null},
      ${false},
      ${null},
      ${row.image_urls || []},
      ${row.supplier_name || 'AliExpress'},
      ${row.supplier_url},
      ${notes || null}
    )
    RETURNING *
  `;
  const p = inserted[0];
  const sizes = (row.sizes || []).length ? row.sizes : ['OS'];
  for (const size of sizes) {
    await sql`
      INSERT INTO product_variants (product_id, size, sku, stock)
      VALUES (${p.id}, ${String(size)}, ${null}, ${Number(row.stock) || 0})
      ON CONFLICT (product_id, size) DO UPDATE SET stock = EXCLUDED.stock
    `;
  }
  await sql`
    UPDATE product_import_queue
    SET status = 'published', published_product_id = ${p.id}, updated_at = now()
    WHERE id = ${row.id}
  `;
  const vars = await sql`SELECT * FROM product_variants WHERE product_id = ${p.id}`;
  return mapProduct(p, vars, { includeCost: true });
}

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireStoreAccess(req, PERM.PRODUCTS);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const id = url.searchParams.get('id') || req.query?.id || null;
  const action = url.searchParams.get('action') || req.query?.action || '';

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM product_import_queue
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return json(res, 200, { items: rows.map(mapQueueRow) });
    }

    if (req.method === 'POST') {
      if (action === 'publish') {
        if (!id) return json(res, 400, { error: 'id is required' });
        const rows = await sql`SELECT * FROM product_import_queue WHERE id = ${id} LIMIT 1`;
        if (!rows[0]) return json(res, 404, { error: 'Draft not found' });
        if (rows[0].status === 'published' && rows[0].published_product_id) {
          return json(res, 409, { error: 'Already published' });
        }
        try {
          const product = await createProductFromQueue(sql, rows[0]);
          return json(res, 200, { ok: true, product });
        } catch (e) {
          return json(res, 400, { error: e?.message || 'Could not publish draft' });
        }
      }

      const body = await readJson(req, { maxChars: 1_000_000 });
      const urls = arr(body.urls || body.supplierUrls || body.supplierUrl);
      if (!urls.length) return json(res, 400, { error: 'Add at least one supplier URL' });
      if (urls.length > 100) return json(res, 400, { error: 'Import queue accepts up to 100 URLs at a time' });

      const inserted = [];
      for (const supplierUrl of urls) {
        if (!/^https?:\/\//i.test(supplierUrl)) continue;
        const row = await sql`
          INSERT INTO product_import_queue (
            supplier_name, supplier_url, title, boutique_name, category, description,
            price_cents, sale_price_cents, cost_cents, image_urls, sizes, stock,
            ships_from, delivery_days_min, delivery_days_max, backup_supplier_url, notes, status
          )
          VALUES (
            ${String(body.supplierName || 'AliExpress').trim() || 'AliExpress'},
            ${supplierUrl},
            ${String(body.title || '').trim() || null},
            ${String(body.boutiqueName || '').trim() || null},
            ${String(body.category || 'Dresses').trim() || 'Dresses'},
            ${String(body.description || '').trim() || null},
            ${centsFromValue(body.price || body.priceCents)},
            ${centsFromValue(body.salePrice || body.salePriceCents)},
            ${centsFromValue(body.cost || body.costCents)},
            ${arr(body.imageUrls)},
            ${arr(body.sizes)},
            ${Number(body.stock) || 0},
            ${String(body.shipsFrom || '').trim() || null},
            ${body.deliveryDaysMin != null && body.deliveryDaysMin !== '' ? Number(body.deliveryDaysMin) : null},
            ${body.deliveryDaysMax != null && body.deliveryDaysMax !== '' ? Number(body.deliveryDaysMax) : null},
            ${String(body.backupSupplierUrl || '').trim() || null},
            ${String(body.notes || '').trim() || null},
            ${body.status === 'ready' ? 'ready' : 'draft'}
          )
          RETURNING *
        `;
        inserted.push(mapQueueRow(row[0]));
      }
      return json(res, 201, { ok: true, items: inserted });
    }

    if (req.method === 'PATCH') {
      if (!id) return json(res, 400, { error: 'id is required' });
      const body = await readJson(req, { maxChars: 1_000_000 });
      const currentRows = await sql`SELECT * FROM product_import_queue WHERE id = ${id} LIMIT 1`;
      const current = currentRows[0];
      if (!current) return json(res, 404, { error: 'Draft not found' });
      const nextStatus =
        body.status !== undefined
          ? ['draft', 'ready', 'published', 'archived'].includes(body.status)
            ? body.status
            : current.status
          : current.status;
      const rows = await sql`
        UPDATE product_import_queue SET
          status = ${nextStatus},
          supplier_name = ${body.supplierName !== undefined ? String(body.supplierName || '').trim() || null : current.supplier_name},
          supplier_url = ${body.supplierUrl !== undefined ? String(body.supplierUrl || '').trim() : current.supplier_url},
          title = ${body.title !== undefined ? String(body.title || '').trim() || null : current.title},
          boutique_name = ${body.boutiqueName !== undefined ? String(body.boutiqueName || '').trim() || null : current.boutique_name},
          category = ${body.category !== undefined ? String(body.category || '').trim() || null : current.category},
          description = ${body.description !== undefined ? String(body.description || '').trim() || null : current.description},
          price_cents = ${body.priceCents !== undefined ? centsFromValue(body.priceCents) : current.price_cents},
          sale_price_cents = ${body.salePriceCents !== undefined ? centsFromValue(body.salePriceCents) : current.sale_price_cents},
          cost_cents = ${body.costCents !== undefined ? centsFromValue(body.costCents) : current.cost_cents},
          image_urls = ${body.imageUrls !== undefined ? arr(body.imageUrls) : current.image_urls || []},
          sizes = ${body.sizes !== undefined ? arr(body.sizes) : current.sizes || []},
          stock = ${body.stock !== undefined ? Number(body.stock) || 0 : current.stock},
          ships_from = ${body.shipsFrom !== undefined ? String(body.shipsFrom || '').trim() || null : current.ships_from},
          delivery_days_min = ${body.deliveryDaysMin !== undefined ? Number(body.deliveryDaysMin) || null : current.delivery_days_min},
          delivery_days_max = ${body.deliveryDaysMax !== undefined ? Number(body.deliveryDaysMax) || null : current.delivery_days_max},
          backup_supplier_url = ${body.backupSupplierUrl !== undefined ? String(body.backupSupplierUrl || '').trim() || null : current.backup_supplier_url},
          notes = ${body.notes !== undefined ? String(body.notes || '').trim() || null : current.notes},
          updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      return json(res, 200, { ok: true, item: mapQueueRow(rows[0]) });
    }

    if (req.method === 'DELETE') {
      if (!id) return json(res, 400, { error: 'id is required' });
      await sql`UPDATE product_import_queue SET status = 'archived', updated_at = now() WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    const mapped = postgresClientError(e);
    return json(res, mapped.status, { error: mapped.error, code: e?.code });
  }
}

export default withCorsContext(handler);
