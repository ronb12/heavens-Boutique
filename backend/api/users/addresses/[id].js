import { getDb } from '../../../lib/db.js';
import { requireUser } from '../../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../../lib/http.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const id = req.query?.id;
  if (!id) return json(res, 400, { error: 'Missing id' });

  const sql = getDb();

  try {
    const rows = await sql`SELECT * FROM user_addresses WHERE id = ${id} AND user_id = ${auth.userId} LIMIT 1`;
    const addr = rows[0];
    if (!addr) return json(res, 404, { error: 'Address not found' });

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const updates = {};
      if (body.name !== undefined) updates.name = body.name || null;
      if (body.label !== undefined) updates.label = body.label || null;
      if (body.line1 !== undefined) updates.line1 = String(body.line1).trim();
      if (body.line2 !== undefined) updates.line2 = body.line2 || null;
      if (body.city !== undefined) updates.city = String(body.city).trim();
      if (body.state !== undefined) updates.state = body.state || null;
      if (body.postal !== undefined) updates.postal = String(body.postal).trim();
      if (body.country !== undefined) updates.country = String(body.country).trim() || 'US';

      if (body.isDefault === true) {
        await sql`UPDATE user_addresses SET is_default = false WHERE user_id = ${auth.userId}`;
        updates.is_default = true;
      }

      if (Object.keys(updates).length > 0) {
        await sql`UPDATE user_addresses SET ${sql(updates)} WHERE id = ${id}`;
      }

      const updated = await sql`SELECT * FROM user_addresses WHERE id = ${id} LIMIT 1`;
      const a = updated[0];
      return json(res, 200, {
        address: {
          id: a.id, name: a.name, label: a.label, line1: a.line1, line2: a.line2,
          city: a.city, state: a.state, postal: a.postal, country: a.country,
          isDefault: a.is_default, createdAt: a.created_at,
        },
      });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM user_addresses WHERE id = ${id} AND user_id = ${auth.userId}`;
      if (addr.is_default) {
        const next = await sql`
          SELECT id FROM user_addresses WHERE user_id = ${auth.userId} ORDER BY created_at DESC LIMIT 1
        `;
        if (next[0]) {
          await sql`UPDATE user_addresses SET is_default = true WHERE id = ${next[0].id}`;
        }
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
