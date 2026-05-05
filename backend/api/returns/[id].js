import { getDb } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { json, handleCors, withCorsContext } from '../../lib/http.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const id = req.query?.id;
  if (!id) return json(res, 400, { error: 'Missing id' });

  const sql = getDb();
  const rows = await sql`
    SELECT r.*, o.total_cents, o.shipping_address
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    WHERE r.id = ${id} AND r.user_id = ${auth.userId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return json(res, 404, { error: 'Return not found' });

  return json(res, 200, {
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
export default withCorsContext(handler);
