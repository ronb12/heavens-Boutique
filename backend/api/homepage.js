import { getDb } from '../lib/db.js';
import { json, handleCors } from '../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const sql = getDb();
  try {
    const rows = await sql`SELECT content, updated_at FROM homepage_content WHERE id = 1 LIMIT 1`;
    const row = rows[0];
    return json(res, 200, {
      content: row?.content || {
        banners: [],
        collections: [],
      },
      updatedAt: row?.updated_at || null,
    });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 200, { content: { banners: [], collections: [] }, updatedAt: null });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

