import { getDb } from '../../lib/db.js';
import { requireUser, requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { sendPushToToken } from '../../lib/fcm.js';

async function handler(req, res) {
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

    if (req.method === 'DELETE') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });
      const body = await readJson(req);
      if (body.deleteAll) {
        await sql`DELETE FROM notifications WHERE user_id = ${auth.userId}`;
      } else if (Array.isArray(body.ids) && body.ids.length) {
        for (const nid of body.ids) {
          await sql`DELETE FROM notifications WHERE id = ${nid} AND user_id = ${auth.userId}`;
        }
      } else {
        return json(res, 400, { error: 'Provide ids (array) or deleteAll: true' });
      }
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST') {
      const admin = await requireStoreAccess(req, PERM.MARKETING);
      if (admin.error) return json(res, admin.status, { error: admin.error });
      const body = await readJson(req);
      const type = body.type || 'promotion';
      const title = String(body.title || '');
      const msg = body.body ? String(body.body) : null;
      const dataJson = body.data ? JSON.stringify(body.data) : null;
      const audience = String(body.audience || 'single').toLowerCase();

      if (!title) {
        return json(res, 400, { error: 'title required' });
      }

      const pushData = {
        type: type || 'promotion',
        ...(body.data && typeof body.data === 'object' ? body.data : {}),
      };
      const pushBody = (msg && msg.trim()) || title;

      if (audience === 'marketing_subscribers') {
        const inserted = await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          SELECT u.id, ${type}, ${title}, ${msg}, ${dataJson}::jsonb
          FROM users u
          WHERE u.role = 'customer'
            AND u.tags IS NOT NULL
            AND 'marketing_emails' = ANY(u.tags)
          RETURNING user_id
        `;
        const sentCount = inserted.length;

        const maxPush = 40;
        let pushSent = 0;
        const pushTargets = inserted.slice(0, maxPush);
        for (const insRow of pushTargets) {
          const uid = insRow.user_id;
          const r = await sql`
            SELECT fcm_token FROM users
            WHERE id = ${uid}
              AND fcm_token IS NOT NULL
              AND length(trim(fcm_token)) > 0
            LIMIT 1
          `;
          const tok = r[0]?.fcm_token?.trim();
          if (!tok) continue;
          try {
            const out = await sendPushToToken({
              token: tok,
              title,
              body: pushBody,
              data: pushData,
            });
            if (out.ok) pushSent += 1;
          } catch (pushErr) {
            console.error('admin promotion push (broadcast)', pushErr);
          }
        }

        return json(res, 201, {
          ok: true,
          sentCount,
          audience: 'marketing_subscribers',
          pushSent,
          pushCapped: inserted.length > maxPush,
        });
      }

      const userId = body.userId;
      if (!userId) {
        return json(res, 400, { error: 'userId required for single-customer send' });
      }

      await sql`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (${userId}, ${type}, ${title}, ${msg}, ${dataJson}::jsonb)
      `;

      const users = await sql`SELECT fcm_token FROM users WHERE id = ${userId} LIMIT 1`;
      const token = users[0]?.fcm_token?.trim();
      if (token) {
        try {
          await sendPushToToken({
            token,
            title,
            body: pushBody,
            data: pushData,
          });
        } catch (pushErr) {
          console.error('admin promotion push (single)', pushErr);
        }
      }

      return json(res, 201, { ok: true, sentCount: 1, audience: 'single' });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
