import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

function asUuid(v) {
  if (!v) return null;
  const s = String(v).trim();
  return /^[0-9a-fA-F-]{36}$/.test(s) ? s : null;
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  try {
    const admin = await requireAdmin(req);
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
            recommendedQty: Math.max(0, (minStock + 5) - (r.stock ?? 0)),
          })),
        });
      }
      if (id) {
        const poRows = await sql`SELECT * FROM purchase_orders WHERE id = ${id} LIMIT 1`;
        if (!poRows.length) return json(res, 404, { error: 'Not found' });
        const items = await sql`
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
        const po = poRows[0];
        return json(res, 200, {
          purchaseOrder: {
            id: po.id,
            status: po.status,
            supplierName: po.supplier_name,
            supplierOrderUrl: po.supplier_order_url,
            supplierOrderNumber: po.supplier_order_number,
            expectedAt: po.expected_at,
            notes: po.notes,
            createdByUserId: po.created_by_user_id,
            createdAt: po.created_at,
            updatedAt: po.updated_at,
            items: items.map((r) => ({
              id: r.id,
              productId: r.product_id,
              variantId: r.variant_id,
              quantity: r.quantity,
              unitCostCents: r.unit_cost_cents,
              supplierUrl: r.supplier_url,
              title: r.title || r.product_name || null,
              productName: r.product_name || null,
              variantSize: r.variant_size || null,
              createdAt: r.created_at,
            })),
          },
        });
      }

      const statusFilter = url.searchParams.get('status');
      // Neon cannot safely interpolate an empty `sql`` fragment; use separate queries.
      const rows = statusFilter
        ? await sql`
            SELECT id, status, supplier_name, supplier_order_url, supplier_order_number, expected_at, notes, created_at, updated_at
            FROM purchase_orders
            WHERE status = ${String(statusFilter)}
            ORDER BY created_at DESC
            LIMIT 200
          `
        : await sql`
            SELECT id, status, supplier_name, supplier_order_url, supplier_order_number, expected_at, notes, created_at, updated_at
            FROM purchase_orders
            ORDER BY created_at DESC
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
          notes: po.notes,
          createdAt: po.created_at,
          updatedAt: po.updated_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const supplierName = body.supplierName != null ? String(body.supplierName).slice(0, 200) : null;
      const supplierOrderUrl = body.supplierOrderUrl != null ? String(body.supplierOrderUrl).slice(0, 2000) : null;
      const supplierOrderNumber = body.supplierOrderNumber != null ? String(body.supplierOrderNumber).slice(0, 200) : null;
      const expectedAt = body.expectedAt ? new Date(body.expectedAt) : null;
      const notes = body.notes != null ? String(body.notes).slice(0, 4000) : null;
      const status = body.status ? String(body.status) : 'draft';
      const items = Array.isArray(body.items) ? body.items : [];

      const ins = await sql`
        INSERT INTO purchase_orders (status, supplier_name, supplier_order_url, supplier_order_number, expected_at, notes, created_by_user_id)
        VALUES (
          ${status},
          ${supplierName},
          ${supplierOrderUrl},
          ${supplierOrderNumber},
          ${expectedAt ? expectedAt.toISOString() : null},
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
        await sql`
          INSERT INTO purchase_order_items (purchase_order_id, product_id, variant_id, quantity, unit_cost_cents, supplier_url, title)
          VALUES (
            ${poId},
            ${productId},
            ${variantId},
            ${quantity},
            ${Number.isFinite(unitCostCents) ? unitCostCents : null},
            ${supplierUrl},
            ${title}
          )
        `;
      }

      return json(res, 200, { ok: true, id: poId });
    }

    if (req.method === 'PATCH') {
      if (!id) return json(res, 400, { error: 'id is required' });
      const body = await readJson(req);
      const status = body.status != null ? String(body.status) : null;
      const supplierName = body.supplierName != null ? String(body.supplierName).slice(0, 200) : null;
      const supplierOrderUrl = body.supplierOrderUrl != null ? String(body.supplierOrderUrl).slice(0, 2000) : null;
      const supplierOrderNumber = body.supplierOrderNumber != null ? String(body.supplierOrderNumber).slice(0, 200) : null;
      const expectedAt = body.expectedAt ? new Date(body.expectedAt) : null;
      const notes = body.notes != null ? String(body.notes).slice(0, 4000) : null;

      await sql`
        UPDATE purchase_orders SET
          status = COALESCE(${status}, status),
          supplier_name = COALESCE(${supplierName}, supplier_name),
          supplier_order_url = COALESCE(${supplierOrderUrl}, supplier_order_url),
          supplier_order_number = COALESCE(${supplierOrderNumber}, supplier_order_number),
          expected_at = COALESCE(${expectedAt ? expectedAt.toISOString() : null}, expected_at),
          notes = COALESCE(${notes}, notes),
          updated_at = now()
        WHERE id = ${id}
      `;

      // If marked received, we auto-increment stock for any variant-linked items.
      if (status === 'received') {
        const items = await sql`
          SELECT variant_id, quantity
          FROM purchase_order_items
          WHERE purchase_order_id = ${id} AND variant_id IS NOT NULL
        `;
        for (const it of items) {
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
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

