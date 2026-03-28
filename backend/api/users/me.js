import { getDb } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  try {
    const sql = getDb();
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, email, full_name, role, loyalty_points, tags, created_at
        FROM users WHERE id = ${auth.userId} LIMIT 1
      `;
      const u = rows[0];
      if (!u) return json(res, 404, { error: 'User not found' });

      const addresses = await sql`
        SELECT id, label, line1, line2, city, state, postal, country, is_default
        FROM user_addresses WHERE user_id = ${auth.userId} ORDER BY is_default DESC, created_at DESC
      `;

      return json(res, 200, {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        loyaltyPoints: u.loyalty_points,
        tags: u.tags || [],
        addresses: addresses.map((a) => ({
          id: a.id,
          label: a.label,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          postal: a.postal,
          country: a.country,
          isDefault: a.is_default,
        })),
      });
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (body.fcmToken !== undefined) {
        await sql`
          UPDATE users SET fcm_token = ${body.fcmToken || null}, updated_at = now()
          WHERE id = ${auth.userId}
        `;
      }
      if (body.fullName !== undefined) {
        await sql`
          UPDATE users SET full_name = ${String(body.fullName).trim() || null}, updated_at = now()
          WHERE id = ${auth.userId}
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
