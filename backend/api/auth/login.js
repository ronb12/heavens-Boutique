import { getDb } from '../../lib/db.js';
import { comparePassword, signToken } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const sql = getDb();
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return json(res, 400, { error: 'Email and password required' });
    }

    const rows = await sql`
      SELECT id, email, password_hash, full_name, role, loyalty_points, fcm_token
      FROM users WHERE email = ${email} LIMIT 1
    `;
    const user = rows[0];
    if (!user || !(await comparePassword(password, user.password_hash))) {
      return json(res, 401, { error: 'Invalid credentials' });
    }

    const token = signToken({ sub: user.id, role: user.role });

    return json(res, 200, {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        loyaltyPoints: user.loyalty_points,
      },
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Login failed' });
  }
}
