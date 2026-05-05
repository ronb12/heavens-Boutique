import { getDb } from '../../lib/db.js';
import { selectUserProfileById } from '../../lib/userStaffRow.js';
import { requireUser, normalizeStaffPermissions } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { hashPassword, comparePassword } from '../../lib/auth.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;

  const auth = requireUser(req);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  try {
    const sql = getDb();
    if (req.method === 'GET') {
      const rows = await selectUserProfileById(sql, auth.userId);
      const u = rows[0];
      if (!u) return json(res, 404, { error: 'User not found' });

      const addresses = await sql`
        SELECT id, label, line1, line2, city, state, postal, country, is_default
        FROM user_addresses WHERE user_id = ${auth.userId} ORDER BY is_default DESC, created_at DESC
      `;

      const body = {
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
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
      };
      if (u.role === 'staff') {
        body.staffPermissions = normalizeStaffPermissions(u.staff_permissions);
        body.staffActive = u.staff_active !== false;
        if (u.staff_title) body.staffTitle = u.staff_title;
      }

      return json(res, 200, body);
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const updates = {};

      if (body.fcmToken !== undefined) {
        updates.fcm_token = body.fcmToken || null;
      }
      if (body.fullName !== undefined) {
        updates.full_name = String(body.fullName).trim() || null;
      }
      if (body.phone !== undefined) {
        const v = String(body.phone).trim();
        updates.phone = v || null;
      }
      if (body.email !== undefined) {
        const v = String(body.email).trim().toLowerCase();
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
          return json(res, 400, { error: 'Invalid email' });
        }
        if (!v) return json(res, 400, { error: 'Email is required' });
        // Ensure unique
        const exists = await sql`SELECT id FROM users WHERE email = ${v} AND id <> ${auth.userId} LIMIT 1`;
        if (exists[0]) return json(res, 409, { error: 'Email already in use' });
        updates.email = v;
      }

      // Password update (supports setting a password for Apple accounts with no hash yet)
      if (body.newPassword !== undefined) {
        const newPw = String(body.newPassword || '');
        if (newPw.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters' });

        const curRows = await sql`SELECT password_hash FROM users WHERE id = ${auth.userId} LIMIT 1`;
        const existingHash = curRows[0]?.password_hash || null;
        const requiresCurrent = Boolean(existingHash);
        if (requiresCurrent) {
          const currentPw = String(body.currentPassword || '');
          const ok = await comparePassword(currentPw, existingHash);
          if (!ok) return json(res, 403, { error: 'Current password is incorrect' });
        }
        updates.password_hash = await hashPassword(newPw);
      }

      if (Object.keys(updates).length > 0) {
        if (Object.prototype.hasOwnProperty.call(updates, 'fcm_token')) {
          await sql`UPDATE users SET fcm_token = ${updates.fcm_token}, updated_at = now() WHERE id = ${auth.userId}`;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'full_name')) {
          await sql`UPDATE users SET full_name = ${updates.full_name}, updated_at = now() WHERE id = ${auth.userId}`;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'phone')) {
          await sql`UPDATE users SET phone = ${updates.phone}, updated_at = now() WHERE id = ${auth.userId}`;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
          await sql`UPDATE users SET email = ${updates.email}, updated_at = now() WHERE id = ${auth.userId}`;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'password_hash')) {
          await sql`UPDATE users SET password_hash = ${updates.password_hash}, updated_at = now() WHERE id = ${auth.userId}`;
        }
      }
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`UPDATE conversations SET staff_id = NULL WHERE staff_id = ${auth.userId}`;
      await sql`DELETE FROM users WHERE id = ${auth.userId}`;
      return json(res, 200, { ok: true, deleted: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
