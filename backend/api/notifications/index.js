import { getDb } from '../../lib/db.js';
import { requireUser, requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const rows = await sql`
        SELECT * FROM notifications
        WHERE user_id = ${auth.userId}
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return json(res, 200, {
        notifications: rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          readAt: n.read_at,
          createdAt: n.created_at,
        })),
      });
    }

    if (req.method === 'PATCH') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });
      const body = await readJson(req);
      const ids = body.ids;
      if (Array.isArray(ids) && ids.length) {
        for (const nid of ids) {
          await sql`
            UPDATE notifications SET read_at = now()
            WHERE id = ${nid} AND user_id = ${auth.userId}
          `;
        }
      } else if (body.markAll) {
        await sql`
          UPDATE notifications SET read_at = now()
          WHERE user_id = ${auth.userId} AND read_at IS NULL
        `;
      }
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST') {
      const admin = await requireAdmin(req);
      if (admin.error) return json(res, admin.status, { error: admin.error });
      const body = await readJson(req);
      const userId = body.userId;
      const type = body.type || 'promotion';
      const title = String(body.title || '');
      const msg = body.body ? String(body.body) : null;
      if (!userId || !title) {
        return json(res, 400, { error: 'userId and title required' });
      }
      await sql`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (${userId}, ${type}, ${title}, ${msg}, ${body.data ? JSON.stringify(body.data) : null}::jsonb)
      `;
      return json(res, 201, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
