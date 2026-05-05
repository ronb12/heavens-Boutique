import { getDb } from '../lib/db.js';
import { requireUser } from '../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../lib/http.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();

  try {
    if (req.method === 'POST') {
      const body = await readJson(req);
      const variantId = String(body.variantId || '').trim();
      if (!variantId) return json(res, 400, { error: 'variantId is required' });

      await sql`
        INSERT INTO back_in_stock_subscriptions (user_id, variant_id)
        VALUES (${auth.userId}, ${variantId})
        ON CONFLICT DO NOTHING
      `;
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const variantId = String(url.searchParams.get('variantId') || '').trim();
      if (!variantId) return json(res, 400, { error: 'variantId is required' });
      await sql`DELETE FROM back_in_stock_subscriptions WHERE user_id = ${auth.userId} AND variant_id = ${variantId}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 500, { error: 'Database missing back_in_stock_subscriptions table. Run migration 012_back_in_stock.sql.' });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
