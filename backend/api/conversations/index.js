import { getDb } from '../../lib/db.js';
import { requireUser, requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const url = new URL(req.url, `http://${req.headers.host}`);
      const all = url.searchParams.get('all') === '1';

      let rows;
      if (all) {
        const admin = await requireAdmin(req);
        if (admin.error) return json(res, admin.status, { error: admin.error });
        rows = await sql`
          SELECT c.*, u.email as customer_email, u.full_name as customer_name
          FROM conversations c
          INNER JOIN users u ON u.id = c.user_id
          ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
          LIMIT 100
        `;
      } else {
        rows = await sql`
          SELECT c.* FROM conversations c
          WHERE c.user_id = ${auth.userId}
          ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
        `;
      }

      return json(res, 200, {
        conversations: rows.map((c) => ({
          id: c.id,
          userId: c.user_id,
          orderId: c.order_id,
          title: c.title,
          lastMessageAt: c.last_message_at,
          customerEmail: c.customer_email,
          customerName: c.customer_name,
        })),
      });
    }

    if (req.method === 'POST') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const body = await readJson(req);
      const orderId = body.orderId || null;
      const title = body.title ? String(body.title) : 'Stylist chat';

      const roleRows = await sql`SELECT role FROM users WHERE id = ${auth.userId} LIMIT 1`;
      const dbRole = roleRows[0]?.role || auth.role || 'customer';
      const isAdmin = dbRole === 'admin';

      let conversationUserId = auth.userId;
      let staffId = null;
      if (isAdmin) {
        const custRaw =
          body.customerUserId != null
            ? String(body.customerUserId).trim()
            : body.userId != null
              ? String(body.userId).trim()
              : '';
        if (!custRaw || !UUID_RE.test(custRaw)) {
          return json(res, 400, {
            error:
              'customerUserId is required when starting a chat as admin (the registered customer you are messaging)',
          });
        }
        const cust = await sql`SELECT id, role FROM users WHERE id = ${custRaw} LIMIT 1`;
        if (!cust[0] || cust[0].role !== 'customer') {
          return json(res, 400, { error: 'customerUserId must be a registered customer account' });
        }
        conversationUserId = custRaw;
        staffId = auth.userId;
      }

      const inserted = await sql`
        INSERT INTO conversations (user_id, order_id, title, staff_id)
        VALUES (${conversationUserId}, ${orderId}, ${title}, ${staffId})
        RETURNING *
      `;
      const c = inserted[0];
      return json(res, 201, {
        conversation: {
          id: c.id,
          userId: c.user_id,
          orderId: c.order_id,
          title: c.title,
        },
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
