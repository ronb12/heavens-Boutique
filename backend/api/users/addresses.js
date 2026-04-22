import { getDb } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

function fmtAddr(a) {
  return {
    id: a.id,
    name: a.name,
    label: a.label,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postal: a.postal,
    country: a.country,
    isDefault: a.is_default,
    createdAt: a.created_at,
  };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM user_addresses
        WHERE user_id = ${auth.userId}
        ORDER BY is_default DESC, created_at DESC
      `;
      return json(res, 200, { addresses: rows.map(fmtAddr) });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const line1 = String(body.line1 || '').trim();
      const city = String(body.city || '').trim();
      const postal = String(body.postal || '').trim();
      const country = String(body.country || 'US').trim();
      if (!line1 || !city || !postal) {
        return json(res, 400, { error: 'line1, city, and postal are required' });
      }

      const existing = await sql`SELECT COUNT(*) AS cnt FROM user_addresses WHERE user_id = ${auth.userId}`;
      const isFirst = Number(existing[0]?.cnt || 0) === 0;

      if (body.isDefault || isFirst) {
        await sql`UPDATE user_addresses SET is_default = false WHERE user_id = ${auth.userId}`;
      }

      const ins = await sql`
        INSERT INTO user_addresses (user_id, name, label, line1, line2, city, state, postal, country, is_default)
        VALUES (
          ${auth.userId},
          ${body.name || null},
          ${body.label || null},
          ${line1},
          ${body.line2 || null},
          ${city},
          ${body.state || null},
          ${postal},
          ${country},
          ${Boolean(body.isDefault) || isFirst}
        )
        RETURNING *
      `;
      return json(res, 201, { address: fmtAddr(ins[0]) });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
