import { getDb } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT r.*, o.total_cents
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      WHERE r.user_id = ${auth.userId}
      ORDER BY r.created_at DESC
    `;
    return json(res, 200, {
      returns: rows.map((r) => ({
        id: r.id,
        orderId: r.order_id,
        reason: r.reason,
        notes: r.notes,
        status: r.status,
        items: r.items,
        returnLabelUrl: r.return_label_url,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const { orderId, reason, notes, items } = body;

    if (!orderId) return json(res, 400, { error: 'orderId is required' });
    if (!reason || !String(reason).trim()) return json(res, 400, { error: 'reason is required' });

    // Verify order belongs to this user
    const orderRows = await sql`SELECT id FROM orders WHERE id = ${orderId} AND user_id = ${auth.userId} LIMIT 1`;
    if (!orderRows[0]) return json(res, 404, { error: 'Order not found' });

    // Prevent duplicate open returns for same order
    const existing = await sql`
      SELECT id FROM returns WHERE order_id = ${orderId} AND status NOT IN ('rejected', 'completed') LIMIT 1
    `;
    if (existing[0]) return json(res, 409, { error: 'A return request is already open for this order' });

    const parsedItems = Array.isArray(items) ? items : [];

    const ins = await sql`
      INSERT INTO returns (order_id, user_id, reason, notes, items, status)
      VALUES (${orderId}, ${auth.userId}, ${String(reason).trim()}, ${notes || null}, ${JSON.stringify(parsedItems)}::jsonb, 'pending')
      RETURNING *
    `;
    const r = ins[0];
    return json(res, 201, {
      return: {
        id: r.id,
        orderId: r.order_id,
        reason: r.reason,
        notes: r.notes,
        status: r.status,
        items: r.items,
        returnLabelUrl: r.return_label_url,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
