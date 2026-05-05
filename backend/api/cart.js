import { getDb } from '../lib/db.js';
import { requireUser } from '../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../lib/http.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    if (req.method === 'POST') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const sql = getDb();
      const body = await readJson(req);
      const items = body.items || [];

      const existing = await sql`
        SELECT id FROM carts WHERE user_id = ${auth.userId} ORDER BY updated_at DESC LIMIT 1
      `;
      const payload = JSON.stringify(items);

      if (existing[0]) {
        await sql`
          UPDATE carts SET items_json = ${payload}::jsonb, updated_at = now()
          WHERE id = ${existing[0].id}
        `;
      } else {
        await sql`
          INSERT INTO carts (user_id, items_json) VALUES (${auth.userId}, ${payload}::jsonb)
        `;
      }

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
