import { getDb } from '../../../lib/db.js';
import { requireUser, requireStoreAccess, PERM } from '../../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../../lib/http.js';
import { sendPushToToken } from '../../../lib/fcm.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const conversationId = req.query?.id;
  if (!conversationId) return json(res, 400, { error: 'Missing conversation id' });

  const sql = getDb();

  try {
    const auth = requireUser(req);
    if (auth.error) return json(res, auth.status, { error: auth.error });

    const teamGate = await requireStoreAccess(req, PERM.CUSTOMERS);
    const isTeam = !teamGate.error;

    const conv = await sql`SELECT * FROM conversations WHERE id = ${conversationId} LIMIT 1`;
    const c = conv[0];
    if (!c) return json(res, 404, { error: 'Not found' });
    if (c.user_id !== auth.userId && !isTeam) {
      return json(res, 403, { error: 'Forbidden' });
    }

    if (req.method === 'GET') {
      const msgs = await sql`
        SELECT m.*, u.full_name as sender_name
        FROM messages m
        INNER JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = ${conversationId}
        ORDER BY m.created_at ASC
        LIMIT 500
      `;

      if (isTeam) {
        await sql`
          UPDATE messages SET read_at = now()
          WHERE conversation_id = ${conversationId} AND sender_id = ${c.user_id} AND read_at IS NULL
        `;
      } else {
        await sql`
          UPDATE messages SET read_at = now()
          WHERE conversation_id = ${conversationId} AND sender_id <> ${auth.userId} AND read_at IS NULL
        `;
      }

      return json(res, 200, {
        messages: msgs.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          senderName: m.sender_name,
          body: m.body,
          imageUrl: m.image_url,
          readAt: m.read_at,
          createdAt: m.created_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const text = body.body != null ? String(body.body).trim() : '';
      const imageUrl = body.imageUrl ? String(body.imageUrl) : null;
      if (!text && !imageUrl) {
        return json(res, 400, { error: 'Message body or image required' });
      }

      const ins = await sql`
        INSERT INTO messages (conversation_id, sender_id, body, image_url)
        VALUES (${conversationId}, ${auth.userId}, ${text || null}, ${imageUrl})
        RETURNING *
      `;
      await sql`
        UPDATE conversations SET last_message_at = now() WHERE id = ${conversationId}
      `;

      const m = ins[0];
      const recipientId = isTeam
        ? c.user_id
        : (await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`)[0]?.id;

      if (recipientId) {
        const u = await sql`SELECT fcm_token FROM users WHERE id = ${recipientId} LIMIT 1`;
        if (u[0]?.fcm_token) {
          await sendPushToToken({
            token: u[0].fcm_token,
            title: 'New message',
            body: text || 'Sent an image',
            data: { type: 'message', conversationId },
          });
        }
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (
            ${recipientId}, 'message', 'New message',
            ${text || 'Image'},
            ${JSON.stringify({ conversationId })}::jsonb
          )
        `;
      }

      return json(res, 201, {
        message: {
          id: m.id,
          senderId: m.sender_id,
          body: m.body,
          imageUrl: m.image_url,
          createdAt: m.created_at,
        },
      });
    }

    if (req.method === 'DELETE') {
      let body = {};
      try {
        body = await readJson(req);
      } catch {
        body = {};
      }
      let messageId = body.messageId != null ? String(body.messageId).trim() : '';
      if (!messageId) {
        try {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const q = url.searchParams.get('messageId');
          if (q) messageId = String(q).trim();
        } catch {
          /* ignore */
        }
      }
      if (messageId) {
        const rows = await sql`
          SELECT id, sender_id FROM messages
          WHERE id = ${messageId} AND conversation_id = ${conversationId}
          LIMIT 1
        `;
        const row = rows[0];
        if (!row) return json(res, 404, { error: 'Message not found' });
        const canDelete = row.sender_id === auth.userId || isTeam;
        if (!canDelete) return json(res, 403, { error: 'Forbidden' });
        await sql`DELETE FROM messages WHERE id = ${messageId}`;
        const last = await sql`
          SELECT max(created_at) as t FROM messages WHERE conversation_id = ${conversationId}
        `;
        const t = last[0]?.t;
        await sql`
          UPDATE conversations SET last_message_at = ${t || null} WHERE id = ${conversationId}
        `;
        return json(res, 200, { ok: true });
      }
      // Clear all messages (empty body or no messageId).
      await sql`DELETE FROM messages WHERE conversation_id = ${conversationId}`;
      await sql`UPDATE conversations SET last_message_at = NULL WHERE id = ${conversationId}`;
      return json(res, 200, { ok: true, cleared: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
