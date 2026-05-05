import { getDb } from '../../lib/db.js';
import { requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cols[j] ?? '';
    }
    out.push(row);
  }
  return out;
}

function parseCents(row, centsKey, dollarsKey) {
  if (row[centsKey] !== undefined && String(row[centsKey]).trim() !== '') {
    const n = Number(row[centsKey]);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (row[dollarsKey] !== undefined && String(row[dollarsKey]).trim() !== '') {
    const s = String(row[dollarsKey]).trim().replace(/^\$\s*/, '').replace(/,/g, '');
    const n = Number.parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  }
  return null;
}

function splitList(v) {
  return String(v || '')
    .split('|')
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

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ',') {
        out.push(cur);
        cur = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireStoreAccess(req, PERM.PRODUCTS_CSV);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT
          p.id AS product_id, p.name, p.slug, p.description, p.category, p.price_cents, p.sale_price_cents,
          p.cost_cents, p.is_featured, p.shop_look_group,
          p.supplier_name, p.supplier_url, p.supplier_notes, array_to_string(p.cloudinary_ids, '|') AS image_urls,
          pv.id AS variant_id, pv.size, pv.sku, pv.stock, pv.weight_oz
        FROM products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        ORDER BY p.created_at DESC, pv.created_at ASC
      `;

      const header = [
        'product_id', 'name', 'slug', 'description', 'category',
        'price_cents', 'sale_price_cents', 'cost_cents',
        'is_featured', 'shop_look_group',
        'supplier_name', 'supplier_url', 'supplier_notes', 'image_urls',
        'variant_id', 'size', 'sku', 'stock', 'weight_oz',
      ];
      const lines = [header.join(',')];
      for (const r of rows) {
        lines.push(
          header.map((h) => csvEscape(r[h])).join(','),
        );
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.end(lines.join('\n'));
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req, { maxChars: 4_000_000 });
      const csv = body.csv;
      if (!csv || typeof csv !== 'string') return json(res, 400, { error: 'csv string is required' });

      const rows = parseCsv(csv);
      if (!rows.length) return json(res, 400, { error: 'No rows found' });
      if (rows.length > 100) return json(res, 400, { error: 'Import up to 100 rows at a time.' });

      let createdProducts = 0;
      let updatedProducts = 0;
      let upsertedVariants = 0;

      for (const r of rows) {
        const slug = String(r.slug || '').trim().toLowerCase() || slugify(r.name);
        const name = String(r.name || '').trim();
        if (!slug || !name) continue;

        const existing = await sql`SELECT id FROM products WHERE slug = ${slug} LIMIT 1`;
        const productId = existing[0]?.id || null;

        const priceCents = parseCents(r, 'price_cents', 'price');
        const salePriceCents = parseCents(r, 'sale_price_cents', 'sale_price');
        const costCents = parseCents(r, 'cost_cents', 'cost');
        const isFeatured = String(r.is_featured || '').toLowerCase() === 'true' || String(r.is_featured) === '1';
        const supplierName = String(r.supplier_name || '').trim() || null;
        const supplierUrl = String(r.supplier_url || '').trim() || null;
        const supplierNotes = String(r.supplier_notes || '').trim() || null;
        const cloudinaryIds = splitList(r.image_urls || r.cloudinary_ids);

        if (!productId) {
          const ins = await sql`
            INSERT INTO products (
              name, slug, description, category, price_cents, sale_price_cents, cost_cents,
              is_featured, shop_look_group, supplier_name, supplier_url, supplier_notes, cloudinary_ids
            )
            VALUES (
              ${name},
              ${slug},
              ${String(r.description || '') || null},
              ${String(r.category || 'general')},
              ${Number.isFinite(priceCents) ? priceCents : 0},
              ${Number.isFinite(salePriceCents) ? salePriceCents : null},
              ${Number.isFinite(costCents) ? costCents : null},
              ${isFeatured},
              ${String(r.shop_look_group || '') || null},
              ${supplierName},
              ${supplierUrl},
              ${supplierNotes},
              ${cloudinaryIds}
            )
            RETURNING id
          `;
          createdProducts++;
          await upsertVariant(sql, ins[0].id, r);
          upsertedVariants++;
        } else {
          await sql`
            UPDATE products SET
              name = ${name},
              description = ${String(r.description || '') || null},
              category = ${String(r.category || 'general')},
              price_cents = ${Number.isFinite(priceCents) ? priceCents : 0},
              sale_price_cents = ${Number.isFinite(salePriceCents) ? salePriceCents : null},
              cost_cents = ${Number.isFinite(costCents) ? costCents : null},
              is_featured = ${isFeatured},
              shop_look_group = ${String(r.shop_look_group || '') || null},
              supplier_name = ${supplierName},
              supplier_url = ${supplierUrl},
              supplier_notes = ${supplierNotes},
              cloudinary_ids = ${cloudinaryIds},
              updated_at = now()
            WHERE id = ${productId}
          `;
          updatedProducts++;
          if (String(r.size || '').trim()) {
            await upsertVariant(sql, productId, r);
            upsertedVariants++;
          }
        }
      }

      return json(res, 200, { ok: true, createdProducts, updatedProducts, upsertedVariants });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

async function upsertVariant(sql, productId, row) {
  const size = String(row.size || '').trim();
  if (!size) return;
  const sku = String(row.sku || '').trim() || null;
  const stock = Number(row.stock);
  const weightOz = row.weight_oz !== '' ? Number(row.weight_oz) : null;
  await sql`
    INSERT INTO product_variants (product_id, size, sku, stock, weight_oz)
    VALUES (
      ${productId},
      ${size},
      ${sku},
      ${Number.isFinite(stock) ? stock : 0},
      ${Number.isFinite(weightOz) ? weightOz : 8}
    )
    ON CONFLICT (product_id, size) DO UPDATE SET
      sku = EXCLUDED.sku,
      stock = EXCLUDED.stock,
      weight_oz = EXCLUDED.weight_oz
  `;
}
export default withCorsContext(handler);
