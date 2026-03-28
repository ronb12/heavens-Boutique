import { getDb } from '../lib/db.js';
import { requireUser } from '../lib/auth.js';
import { json, handleCors } from '../lib/http.js';
import { mapProduct } from '../lib/productsMap.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT p.* FROM wishlist w
        INNER JOIN products p ON p.id = w.product_id
        WHERE w.user_id = ${auth.userId}
        ORDER BY w.created_at DESC
      `;
      const products = [];
      for (const p of rows) {
        const vars = await sql`SELECT * FROM product_variants WHERE product_id = ${p.id}`;
        products.push(mapProduct(p, vars));
      }
      return json(res, 200, { products });
    }

    if (req.method === 'POST') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const productId = url.searchParams.get('productId');
      if (!productId) return json(res, 400, { error: 'productId required' });
      await sql`
        INSERT INTO wishlist (user_id, product_id) VALUES (${auth.userId}, ${productId})
        ON CONFLICT DO NOTHING
      `;
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const productId = url.searchParams.get('productId');
      if (!productId) return json(res, 400, { error: 'productId required' });
      await sql`DELETE FROM wishlist WHERE user_id = ${auth.userId} AND product_id = ${productId}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
