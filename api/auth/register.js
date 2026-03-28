import { getDb } from '../../lib/db.js';
import { hashPassword, signToken } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const sql = getDb();
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = body.fullName ? String(body.fullName).trim() : null;

    if (!email || !password || password.length < 8) {
      return json(res, 400, { error: 'Valid email and password (8+ chars) required' });
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const role = adminEmails.includes(email) ? 'admin' : 'customer';

    const passwordHash = await hashPassword(password);
    const rows = await sql`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (${email}, ${passwordHash}, ${fullName}, ${role})
      RETURNING id, email, full_name, role, loyalty_points
    `;

    const user = rows[0];
    const token = signToken({ sub: user.id, role: user.role });

    return json(res, 201, {
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
    if (e.code === '23505') {
      return json(res, 409, { error: 'Email already registered' });
    }
    console.error(e);
    return json(res, 500, { error: 'Registration failed' });
  }
}
