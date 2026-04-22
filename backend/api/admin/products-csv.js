import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

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

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT
          p.id AS product_id, p.name, p.slug, p.description, p.category, p.price_cents, p.sale_price_cents,
          p.cost_cents, p.is_featured, p.shop_look_group,
          pv.id AS variant_id, pv.size, pv.sku, pv.stock, pv.weight_oz
        FROM products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        ORDER BY p.created_at DESC, pv.created_at ASC
      `;

      const header = [
        'product_id', 'name', 'slug', 'description', 'category',
        'price_cents', 'sale_price_cents', 'cost_cents',
        'is_featured', 'shop_look_group',
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

      let createdProducts = 0;
      let updatedProducts = 0;
      let upsertedVariants = 0;

      for (const r of rows) {
        const slug = String(r.slug || '').trim().toLowerCase();
        const name = String(r.name || '').trim();
        if (!slug || !name) continue;

        const existing = await sql`SELECT id FROM products WHERE slug = ${slug} LIMIT 1`;
        const productId = existing[0]?.id || null;

        const priceCents = Number(r.price_cents);
        const salePriceCents = r.sale_price_cents !== '' ? Number(r.sale_price_cents) : null;
        const costCents = r.cost_cents !== '' ? Number(r.cost_cents) : null;
        const isFeatured = String(r.is_featured || '').toLowerCase() === 'true' || String(r.is_featured) === '1';

        if (!productId) {
          const ins = await sql`
            INSERT INTO products (name, slug, description, category, price_cents, sale_price_cents, cost_cents, is_featured, shop_look_group)
            VALUES (
              ${name},
              ${slug},
              ${String(r.description || '') || null},
              ${String(r.category || 'general')},
              ${Number.isFinite(priceCents) ? priceCents : 0},
              ${Number.isFinite(salePriceCents) ? salePriceCents : null},
              ${Number.isFinite(costCents) ? costCents : null},
              ${isFeatured},
              ${String(r.shop_look_group || '') || null}
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

