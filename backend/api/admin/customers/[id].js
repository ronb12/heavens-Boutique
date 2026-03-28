import { getDb } from '../../../lib/db.js';
import { requireAdmin } from '../../../lib/auth.js';
import { json, readJson, handleCors } from '../../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const userId = req.query?.id;
  if (!userId) return json(res, 400, { error: 'Missing id' });

  const sql = getDb();

  try {
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (Array.isArray(body.tags)) {
        await sql`UPDATE users SET tags = ${body.tags}, updated_at = now() WHERE id = ${userId}`;
      }
      const rows = await sql`
        SELECT id, email, full_name, role, loyalty_points, tags FROM users WHERE id = ${userId} LIMIT 1
      `;
      const u = rows[0];
      if (!u) return json(res, 404, { error: 'Not found' });
      return json(res, 200, {
        user: {
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          role: u.role,
          loyaltyPoints: u.loyalty_points,
          tags: u.tags || [],
        },
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
