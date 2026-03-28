import { getDb } from '../../lib/db.js';
import { json, handleCors } from '../../lib/http.js';
import { sendPushToToken } from '../../lib/fcm.js';

/** Vercel Cron: schedule hourly. Set CRON_SECRET and Authorization: Bearer <secret> */
export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${secret}`) {
      return json(res, 401, { error: 'Unauthorized' });
    }
  }

  const sql = getDb();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const stale = await sql`
      SELECT c.*, u.fcm_token, u.email
      FROM carts c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.updated_at < ${oneHourAgo}
        AND jsonb_array_length(c.items_json) > 0
    `;

    let n1 = 0;
    let n24 = 0;

    for (const row of stale) {
      const items = row.items_json;
      if (!items || !Array.isArray(items) || items.length === 0) continue;

      if (!row.notified_1h && row.updated_at < oneHourAgo) {
        await sql`
          UPDATE carts SET notified_1h = true WHERE id = ${row.id}
        `;
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (
            ${row.user_id}, 'abandoned_cart', 'Still thinking it over?',
            'Your cart is waiting — complete checkout when you are ready.',
            ${JSON.stringify({ cartId: row.id })}::jsonb
          )
        `;
        if (row.fcm_token) {
          await sendPushToToken({
            token: row.fcm_token,
            title: 'Your cart is waiting',
            body: 'Tap to return to Heaven Boutique.',
            data: { type: 'abandoned_cart' },
          });
        }
        n1++;
      }

      if (!row.notified_24h && row.updated_at < oneDayAgo) {
        await sql`
          UPDATE carts SET notified_24h = true, promo_hint = 'COMEBACK10' WHERE id = ${row.id}
        `;
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (
            ${row.user_id}, 'abandoned_cart', 'A little gift for you',
            'Use code COMEBACK10 on your next order (limited time).',
            ${JSON.stringify({ promo: 'COMEBACK10' })}::jsonb
          )
        `;
        if (row.fcm_token) {
          await sendPushToToken({
            token: row.fcm_token,
            title: 'Exclusive offer',
            body: 'Save on the pieces you loved — code inside.',
            data: { type: 'abandoned_cart' },
          });
        }
        n24++;
      }
    }

    return json(res, 200, { processed: stale.length, notified1h: n1, notified24h: n24 });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: String(e.message) });
  }
}
