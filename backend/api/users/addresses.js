import { getDb } from '../../lib/db.js';
import { requireUser } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();

  try {
    if (req.method === 'POST') {
      const body = await readJson(req);
      const line1 = String(body.line1 || '').trim();
      const city = String(body.city || '').trim();
      const postal = String(body.postal || '').trim();
      const country = String(body.country || 'US').trim();
      if (!line1 || !city || !postal) {
        return json(res, 400, { error: 'line1, city, postal required' });
      }

      if (body.isDefault) {
        await sql`UPDATE user_addresses SET is_default = false WHERE user_id = ${auth.userId}`;
      }

      const ins = await sql`
        INSERT INTO user_addresses (user_id, label, line1, line2, city, state, postal, country, is_default)
        VALUES (
          ${auth.userId},
          ${body.label || null},
          ${line1},
          ${body.line2 || null},
          ${city},
          ${body.state || null},
          ${postal},
          ${country},
          ${Boolean(body.isDefault)}
        )
        RETURNING *
      `;
      const a = ins[0];
      return json(res, 201, {
        address: {
          id: a.id,
          label: a.label,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          postal: a.postal,
          country: a.country,
          isDefault: a.is_default,
        },
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
