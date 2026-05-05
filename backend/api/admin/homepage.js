import { getDb } from '../../lib/db.js';
import { requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireStoreAccess(req, PERM.HOMEPAGE);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT content, updated_at FROM homepage_content WHERE id = 1 LIMIT 1`;
      const row = rows[0];
      return json(res, 200, { content: row?.content || { banners: [], collections: [] }, updatedAt: row?.updated_at || null });
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      const content = body.content && typeof body.content === 'object' ? body.content : {};
      await sql`
        INSERT INTO homepage_content (id, content, updated_at)
        VALUES (1, ${JSON.stringify(content)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = now()
      `;
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 500, { error: 'Database missing homepage_content table. Run migration 014_homepage_cms.sql.' });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
