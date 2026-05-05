import { getDb } from '../../lib/db.js';
import { requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';

const PO_STATUSES = new Set(['draft', 'ordered', 'shipped', 'received', 'cancelled']);

function asUuid(v) {
  if (!v) return null;
  const s = String(v).trim();
  return /^[0-9a-fA-F-]{36}$/.test(s) ? s : null;
}

function mapPoRow(po) {
  return {
    id: po.id,
    status: po.status,
    supplierName: po.supplier_name,
    supplierOrderUrl: po.supplier_order_url,
    supplierOrderNumber: po.supplier_order_number,
    expectedAt: po.expected_at,
    paymentTerms: po.payment_terms ?? null,
    shipTo: po.ship_to ?? null,
    notes: po.notes,
    createdByUserId: po.created_by_user_id,
    createdAt: po.created_at,
    updatedAt: po.updated_at,
  };
}

function mapItemRow(r) {
  return {
    id: r.id,
    productId: r.product_id,
    variantId: r.variant_id,
    quantity: r.quantity,
    unitCostCents: r.unit_cost_cents,
    supplierUrl: r.supplier_url,
    title: r.title || r.product_name || null,
    productName: r.product_name || null,
    variantSize: r.variant_size || null,
    qualitySpec: r.quality_spec ?? null,
    lineTotalCents:
      r.unit_cost_cents != null && r.quantity != null
        ? Math.round(Number(r.unit_cost_cents) * Number(r.quantity))
        : null,
    createdAt: r.created_at,
  };
}

/** @param {unknown} body @param {string} key */
function optionalTextPatch(body, key, maxLen) {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v == null || v === '') return null;
  return String(v).slice(0, maxLen);
}

/** @param {unknown} body @param {string} key */
function optionalDatePatch(body, key) {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v == null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'invalid';
  return d.toISOString();
}

function isUndefinedColumnError(e) {
  return e?.code === '42703' || /column .* does not exist/i.test(String(e?.message || ''));
}

async function handler(req, res) {
  if (handleCors(req, res)) return;
  try {
    const admin = await requireStoreAccess(req, PERM.PURCHASE_ORDERS);
    if (admin.error) return json(res, admin.status, { error: admin.error });

    const sql = getDb();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const id = asUuid(url.searchParams.get('id'));
    const suggest = url.searchParams.get('suggest') === '1';
    if (req.method === 'GET') {
      if (suggest) {
        const threshold = Number(url.searchParams.get('threshold') ?? 3);
        const minStock = Number.isFinite(threshold) ? Math.max(0, Math.min(9999, threshold)) : 3;
        const rows = await sql`
          SELECT
            pv.id AS variant_id,
            pv.product_id,
            pv.size,
            pv.sku,
            pv.stock,
            p.name AS product_name,
            p.supplier_name,
            p.supplier_url,
            p.cost_cents
          FROM product_variants pv
          JOIN products p ON p.id = pv.product_id
          WHERE pv.stock <= ${minStock}
          ORDER BY pv.stock ASC, p.updated_at DESC
          LIMIT 200
        `;
        return json(res, 200, {
          minStock,
          suggestions: rows.map((r) => ({
            productId: r.product_id,
            variantId: r.variant_id,
            productName: r.product_name,
            size: r.size,
            sku: r.sku,
            stock: r.stock,
            supplierName: r.supplier_name || null,
            supplierUrl: r.supplier_url || null,
            unitCostCents: r.cost_cents ?? null,
            // Simple recommendation: top up to minStock + 5
            recommendedQty: Math.max(0, minStock + 5 - (r.stock ?? 0)),
          })),
        });
      }
      if (id) {
        const poRows = await sql`SELECT * FROM purchase_orders WHERE id = ${id} LIMIT 1`;
        if (!poRows.length) return json(res, 404, { error: 'Not found' });
        let items;
        try {
          items = await sql`
            SELECT
              i.*,
              p.name AS product_name,
              pv.size AS variant_size
            FROM purchase_order_items i
            LEFT JOIN products p ON p.id = i.product_id
            LEFT JOIN product_variants pv ON pv.id = i.variant_id
            WHERE i.purchase_order_id = ${id}
            ORDER BY i.created_at ASC
          `;
        } catch (itemErr) {
          if (!isUndefinedColumnError(itemErr)) throw itemErr;
          items = await sql`
            SELECT
              i.id,
              i.purchase_order_id,
              i.product_id,
              i.variant_id,
              i.quantity,
              i.unit_cost_cents,
              i.supplier_url,
              i.title,
              i.created_at,
              p.name AS product_name,
              pv.size AS variant_size
            FROM purchase_order_items i
            LEFT JOIN products p ON p.id = i.product_id
            LEFT JOIN product_variants pv ON pv.id = i.variant_id
            WHERE i.purchase_order_id = ${id}
            ORDER BY i.created_at ASC
          `;
        }
        const po = poRows[0];
        const subtotalCents = items.reduce((acc, r) => {
          if (r.unit_cost_cents == null) return acc;
          return acc + Number(r.unit_cost_cents) * Number(r.quantity);
        }, 0);
        return json(res, 200, {
          purchaseOrder: {
            ...mapPoRow(po),
            items: items.map(mapItemRow),
            subtotalCents,
            itemCount: items.length,
          },
        });
      }

      const statusFilter = url.searchParams.get('status');
      // List query avoids po.payment_terms / po.ship_to so DBs without migration 028 still load.
      // Detail GET and PATCH still use those fields when present.
      const rows = statusFilter
        ? await sql`
            SELECT
              po.id,
              po.status,
              po.supplier_name,
              po.supplier_order_url,
              po.supplier_order_number,
              po.expected_at,
              po.notes,
              po.created_at,
              po.updated_at,
              COUNT(i.id)::int AS item_count,
              COALESCE(SUM(i.quantity * COALESCE(i.unit_cost_cents, 0)), 0)::bigint AS subtotal_cents
            FROM purchase_orders po
            LEFT JOIN purchase_order_items i ON i.purchase_order_id = po.id
            WHERE po.status = ${String(statusFilter)}
            GROUP BY po.id
            ORDER BY po.created_at DESC
            LIMIT 200
          `
        : await sql`
            SELECT
              po.id,
              po.status,
              po.supplier_name,
              po.supplier_order_url,
              po.supplier_order_number,
              po.expected_at,
              po.notes,
              po.created_at,
              po.updated_at,
              COUNT(i.id)::int AS item_count,
              COALESCE(SUM(i.quantity * COALESCE(i.unit_cost_cents, 0)), 0)::bigint AS subtotal_cents
            FROM purchase_orders po
            LEFT JOIN purchase_order_items i ON i.purchase_order_id = po.id
            GROUP BY po.id
            ORDER BY po.created_at DESC
            LIMIT 200
          `;
      return json(res, 200, {
        purchaseOrders: rows.map((po) => ({
          id: po.id,
          status: po.status,
          supplierName: po.supplier_name,
          supplierOrderUrl: po.supplier_order_url,
          supplierOrderNumber: po.supplier_order_number,
          expectedAt: po.expected_at,
          paymentTerms: po.payment_terms ?? null,
          shipTo: po.ship_to ?? null,
          notes: po.notes,
          createdAt: po.created_at,
          updatedAt: po.updated_at,
          itemCount: po.item_count ?? 0,
          subtotalCents: Number(po.subtotal_cents ?? 0),
        })),
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const supplierName = body.supplierName != null ? String(body.supplierName).slice(0, 200) : null;
      const supplierOrderUrl = body.supplierOrderUrl != null ? String(body.supplierOrderUrl).slice(0, 2000) : null;
      const supplierOrderNumber = body.supplierOrderNumber != null ? String(body.supplierOrderNumber).slice(0, 200) : null;
      const expectedAt = body.expectedAt ? new Date(body.expectedAt) : null;
      const paymentTerms = body.paymentTerms != null ? String(body.paymentTerms).slice(0, 2000) : null;
      const shipTo = body.shipTo != null ? String(body.shipTo).slice(0, 4000) : null;
      const notes = body.notes != null ? String(body.notes).slice(0, 4000) : null;
      const status = body.status ? String(body.status) : 'draft';
      if (!PO_STATUSES.has(status)) return json(res, 400, { error: 'Invalid status' });
      const items = Array.isArray(body.items) ? body.items : [];

      const ins = await sql`
        INSERT INTO purchase_orders (
          status,
          supplier_name,
          supplier_order_url,
          supplier_order_number,
          expected_at,
          payment_terms,
          ship_to,
          notes,
          created_by_user_id
        )
        VALUES (
          ${status},
          ${supplierName},
          ${supplierOrderUrl},
          ${supplierOrderNumber},
          ${expectedAt && !Number.isNaN(expectedAt.getTime()) ? expectedAt.toISOString() : null},
          ${paymentTerms},
          ${shipTo},
          ${notes},
          ${admin.userId || null}
        )
        RETURNING id
      `;
      const poId = ins[0].id;

      for (const it of items) {
        const productId = asUuid(it.productId);
        const variantId = asUuid(it.variantId);
        const quantity = Number(it.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) continue;
        const unitCostCents = it.unitCostCents != null ? Number(it.unitCostCents) : null;
        const supplierUrl = it.supplierUrl != null ? String(it.supplierUrl).slice(0, 2000) : null;
        const title = it.title != null ? String(it.title).slice(0, 500) : null;
        const qualitySpec = it.qualitySpec != null ? String(it.qualitySpec).slice(0, 2000) : null;
        await sql`
          INSERT INTO purchase_order_items (
            purchase_order_id,
            product_id,
            variant_id,
            quantity,
            unit_cost_cents,
            supplier_url,
            title,
            quality_spec
          )
          VALUES (
            ${poId},
            ${productId},
            ${variantId},
            ${quantity},
            ${Number.isFinite(unitCostCents) ? Math.max(0, Math.round(unitCostCents)) : null},
            ${supplierUrl},
            ${title},
            ${qualitySpec}
          )
        `;
      }

      return json(res, 200, { ok: true, id: poId });
    }

    if (req.method === 'PATCH') {
      if (!id) return json(res, 400, { error: 'id is required' });
      const body = await readJson(req);
      const existing = await sql`SELECT * FROM purchase_orders WHERE id = ${id} LIMIT 1`;
      if (!existing.length) return json(res, 404, { error: 'Not found' });
      const po = existing[0];

      if (Array.isArray(body.items)) {
        if (['received', 'cancelled'].includes(po.status)) {
          return json(res, 400, {
            error: 'Cannot change line items once the PO is received or cancelled.',
          });
        }
        const queries = [sql`DELETE FROM purchase_order_items WHERE purchase_order_id = ${id}`];
        for (const it of body.items) {
          const productId = asUuid(it.productId);
          const variantId = asUuid(it.variantId);
          const quantity = Number(it.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) continue;
          const unitCostCents = it.unitCostCents != null ? Number(it.unitCostCents) : null;
          const supplierUrl = it.supplierUrl != null ? String(it.supplierUrl).slice(0, 2000) : null;
          const title = it.title != null ? String(it.title).slice(0, 500) : null;
          const qualitySpec = it.qualitySpec != null ? String(it.qualitySpec).slice(0, 2000) : null;
          queries.push(sql`
            INSERT INTO purchase_order_items (
              purchase_order_id,
              product_id,
              variant_id,
              quantity,
              unit_cost_cents,
              supplier_url,
              title,
              quality_spec
            )
            VALUES (
              ${id},
              ${productId},
              ${variantId},
              ${quantity},
              ${Number.isFinite(unitCostCents) ? Math.max(0, Math.round(unitCostCents)) : null},
              ${supplierUrl},
              ${title},
              ${qualitySpec}
            )
          `);
        }
        await sql.transaction(queries);
      }

      const nextStatus = body.status != null ? String(body.status) : po.status;
      if (!PO_STATUSES.has(nextStatus)) return json(res, 400, { error: 'Invalid status' });

      const sn = optionalTextPatch(body, 'supplierName', 200);
      const su = optionalTextPatch(body, 'supplierOrderUrl', 2000);
      const son = optionalTextPatch(body, 'supplierOrderNumber', 200);
      const pt = optionalTextPatch(body, 'paymentTerms', 2000);
      const st = optionalTextPatch(body, 'shipTo', 4000);
      const nt = optionalTextPatch(body, 'notes', 4000);
      const ex = optionalDatePatch(body, 'expectedAt');
      if (ex === 'invalid') return json(res, 400, { error: 'Invalid expectedAt' });

      await sql`
        UPDATE purchase_orders SET
          status = ${nextStatus},
          supplier_name = ${sn !== undefined ? sn : po.supplier_name},
          supplier_order_url = ${su !== undefined ? su : po.supplier_order_url},
          supplier_order_number = ${son !== undefined ? son : po.supplier_order_number},
          expected_at = ${ex !== undefined ? ex : po.expected_at},
          payment_terms = ${pt !== undefined ? pt : po.payment_terms},
          ship_to = ${st !== undefined ? st : po.ship_to},
          notes = ${nt !== undefined ? nt : po.notes},
          updated_at = now()
        WHERE id = ${id}
      `;

      if (nextStatus === 'received' && po.status !== 'received') {
        const stockItems = await sql`
          SELECT variant_id, quantity
          FROM purchase_order_items
          WHERE purchase_order_id = ${id} AND variant_id IS NOT NULL
        `;
        for (const it of stockItems) {
          await sql`UPDATE product_variants SET stock = stock + ${it.quantity} WHERE id = ${it.variant_id}`;
        }
      }

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (msg.includes('DATABASE_URL')) {
      return json(res, 500, { error: 'Server misconfigured: database URL missing.' });
    }
    const missingRelation =
      e?.code === '42P01' || /relation ["']?purchase_orders["']? does not exist/i.test(msg);
    if (missingRelation) {
      return json(res, 500, {
        error: 'Database missing purchase order tables. Run migration 017_purchase_orders.sql.',
      });
    }
    const missingColumn = e?.code === '42703' || /column .* does not exist/i.test(msg);
    if (missingColumn) {
      return json(res, 500, {
        error: 'Database schema out of date. Run migration 028_purchase_order_fields.sql.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
