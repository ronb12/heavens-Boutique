import { getDb } from '../../lib/db.js';
import { selectUserForLoginByEmail } from '../../lib/userStaffRow.js';
import { comparePassword, signToken, normalizeStaffPermissions } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';

async function handler(req, res) {
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

    const rows = await selectUserForLoginByEmail(sql, email);
    const user = rows[0];
    if (!user || !user.password_hash || !(await comparePassword(password, user.password_hash))) {
      return json(res, 401, { error: 'Invalid credentials' });
    }

    // Promote to admin if this email is listed in ADMIN_EMAILS (fixes accounts that
    // registered before env was set — register.js only assigns admin on first signup).
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    let role = user.role;
    if (adminEmails.includes(email) && role !== 'admin') {
      const promoted = await sql`
        UPDATE users SET role = 'admin', updated_at = now()
        WHERE id = ${user.id}
        RETURNING role
      `;
      role = promoted[0]?.role ?? 'admin';
    }

    if (role === 'staff' && user.staff_active === false) {
      return json(res, 403, { error: 'Staff account deactivated' });
    }

    const token = signToken({ sub: user.id, role });

    const payloadUser = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role,
      loyaltyPoints: user.loyalty_points,
    };
    if (role === 'staff') {
      payloadUser.staffPermissions = normalizeStaffPermissions(user.staff_permissions);
      payloadUser.staffActive = user.staff_active !== false;
      if (user.staff_title) payloadUser.staffTitle = user.staff_title;
    }

    return json(res, 200, {
      token,
      user: payloadUser,
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Login failed' });
  }
}
export default withCorsContext(handler);
