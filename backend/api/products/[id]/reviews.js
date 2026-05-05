import { getDb } from '../../../lib/db.js';
import { requireUser } from '../../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../../lib/http.js';

function fmt(r) {
  return {
    id: r.id,
    productId: r.product_id,
    userId: r.user_id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verifiedPurchase: r.verified_purchase,
    createdAt: r.created_at,
  };
}

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const id = req.query?.id;
  if (!id) return json(res, 400, { error: 'Missing product id' });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM product_reviews
        WHERE product_id = ${id}
        ORDER BY created_at DESC
        LIMIT 50
      `;
      const agg = await sql`
        SELECT
          COUNT(*)::int AS count,
          COALESCE(AVG(rating), 0)::float AS avg
        FROM product_reviews
        WHERE product_id = ${id}
      `;
      return json(res, 200, {
        summary: {
          count: agg[0]?.count ?? 0,
          average: Number(agg[0]?.avg ?? 0),
        },
        reviews: rows.map(fmt),
      });
    }

    if (req.method === 'POST') {
      const auth = requireUser(req);
      if (auth.error) return json(res, auth.status, { error: auth.error });

      const body = await readJson(req);
      const rating = Number(body.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return json(res, 400, { error: 'rating must be 1–5' });
      }
      const title = body.title != null ? String(body.title).trim() : '';
      const text = body.body != null ? String(body.body).trim() : '';

      // verified purchase: user has an order containing this product
      const owned = await sql`
        SELECT 1
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.user_id = ${auth.userId}
          AND oi.product_id = ${id}
          AND o.status IN ('paid', 'shipped', 'delivered')
        LIMIT 1
      `;
      const verifiedPurchase = Boolean(owned[0]);

      const ins = await sql`
        INSERT INTO product_reviews (product_id, user_id, rating, title, body, verified_purchase)
        VALUES (${id}, ${auth.userId}, ${Math.round(rating)}, ${title || null}, ${text || null}, ${verifiedPurchase})
        ON CONFLICT (product_id, user_id) DO UPDATE SET
          rating = EXCLUDED.rating,
          title = EXCLUDED.title,
          body = EXCLUDED.body,
          verified_purchase = EXCLUDED.verified_purchase,
          updated_at = now()
        RETURNING *
      `;

      return json(res, 201, { review: fmt(ins[0]) });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 500, { error: 'Database missing product_reviews table. Run migration 011_product_reviews.sql.' });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
