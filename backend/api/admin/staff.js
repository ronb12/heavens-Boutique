import { getDb } from '../../lib/db.js';
import { requireAdmin, normalizeStaffPermissions, hashPassword } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { STAFF_TITLE_OPTIONS, normalizeStaffTitleInput } from '../../lib/staffTitles.js';

function mapUserRow(u) {
  const perms = normalizeStaffPermissions(u.staff_permissions);
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    staffPermissions: perms,
    staffActive: u.staff_active !== false,
    staffTitle: u.staff_title || null,
    createdAt: u.created_at,
  };
}

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const gate = await requireAdmin(req);
  if (gate.error) return json(res, gate.status, { error: gate.error });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, email, full_name, role, staff_permissions, staff_active, staff_title, created_at
        FROM users
        WHERE role IN ('admin', 'staff')
        ORDER BY role DESC, email ASC
      `;
      return json(res, 200, {
        staff: rows.map(mapUserRow),
        titleOptions: STAFF_TITLE_OPTIONS,
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const email = String(body.email || '')
        .trim()
        .toLowerCase();
      const password = String(body.password || '');
      const fullName = body.fullName != null ? String(body.fullName).trim() || null : null;
      const permissions = normalizeStaffPermissions(body.permissions || body.staffPermissions);
      if (!String(body.staffTitle || '').trim()) {
        return json(res, 400, { error: 'Staff job title is required' });
      }
      const titleNorm = normalizeStaffTitleInput(body.staffTitle);
      if (titleNorm.error) return json(res, 400, { error: titleNorm.error });
      if (!titleNorm.value) {
        return json(res, 400, { error: 'Staff job title is required' });
      }
      const staffTitle = titleNorm.value;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { error: 'Valid email required' });
      }
      if (password.length < 8) {
        return json(res, 400, { error: 'Password must be at least 8 characters' });
      }

      const existing = await sql`
        SELECT id, role FROM users WHERE email = ${email} LIMIT 1
      `;
      const ex = existing[0];
      if (ex?.role === 'admin') {
        return json(res, 409, { error: 'That account is already a store owner' });
      }

      const pwHash = await hashPassword(password);
      const permJson = JSON.stringify(permissions);

      if (ex) {
        await sql`
          UPDATE users SET
            role = 'staff',
            password_hash = COALESCE(password_hash, ${pwHash}),
            staff_permissions = ${permJson}::jsonb,
            staff_active = true,
            full_name = COALESCE(${fullName}, full_name),
            staff_title = ${staffTitle},
            updated_at = now()
          WHERE id = ${ex.id}
        `;
        const rows = await sql`
          SELECT id, email, full_name, role, staff_permissions, staff_active, staff_title, created_at
          FROM users WHERE id = ${ex.id} LIMIT 1
        `;
        return json(res, 200, { staff: mapUserRow(rows[0]) });
      }

      const ins = await sql`
        INSERT INTO users (email, password_hash, full_name, role, staff_permissions, staff_active, staff_title)
        VALUES (${email}, ${pwHash}, ${fullName}, 'staff', ${permJson}::jsonb, true, ${staffTitle})
        RETURNING id, email, full_name, role, staff_permissions, staff_active, staff_title, created_at
      `;
      return json(res, 201, { staff: mapUserRow(ins[0]) });
    }

    if (req.method === 'PATCH') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get('id') || url.searchParams.get('userId');
      if (!id) return json(res, 400, { error: 'id query required' });

      const row = await sql`SELECT id, role FROM users WHERE id = ${id} LIMIT 1`;
      const u = row[0];
      if (!u) return json(res, 404, { error: 'Not found' });
      if (u.role === 'admin') {
        return json(res, 403, { error: 'Cannot edit store owner from Staff' });
      }

      const body = await readJson(req);
      let touched = false;

      if (body.permissions != null || body.staffPermissions != null) {
        const perms = normalizeStaffPermissions(body.permissions || body.staffPermissions);
        await sql`
          UPDATE users SET staff_permissions = ${JSON.stringify(perms)}::jsonb, updated_at = now()
          WHERE id = ${id}
        `;
        touched = true;
      }
      if (body.staffActive != null) {
        await sql`
          UPDATE users SET staff_active = ${Boolean(body.staffActive)}, updated_at = now()
          WHERE id = ${id}
        `;
        touched = true;
      }
      if (body.fullName !== undefined) {
        const fn = body.fullName ? String(body.fullName).trim() : null;
        await sql`UPDATE users SET full_name = ${fn}, updated_at = now() WHERE id = ${id}`;
        touched = true;
      }
      if (body.password !== undefined) {
        const pw = String(body.password || '');
        if (pw.length < 8) return json(res, 400, { error: 'Password must be at least 8 characters' });
        const ph = await hashPassword(pw);
        await sql`UPDATE users SET password_hash = ${ph}, updated_at = now() WHERE id = ${id}`;
        touched = true;
      }
      if (body.staffTitle !== undefined) {
        const t = normalizeStaffTitleInput(body.staffTitle);
        if (t.error) return json(res, 400, { error: t.error });
        await sql`UPDATE users SET staff_title = ${t.value}, updated_at = now() WHERE id = ${id}`;
        touched = true;
      }

      if (!touched) return json(res, 400, { error: 'Nothing to update' });

      const rows = await sql`
        SELECT id, email, full_name, role, staff_permissions, staff_active, staff_title, created_at
        FROM users WHERE id = ${id} LIMIT 1
      `;
      return json(res, 200, { staff: mapUserRow(rows[0]) });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get('id') || url.searchParams.get('userId');
      if (!id) return json(res, 400, { error: 'id query required' });

      const row = await sql`SELECT id, role FROM users WHERE id = ${id} LIMIT 1`;
      const u = row[0];
      if (!u) return json(res, 404, { error: 'Not found' });
      if (u.role === 'admin') {
        return json(res, 403, { error: 'Cannot remove store owner' });
      }

      await sql`
        UPDATE users SET
          role = 'customer',
          staff_permissions = '{}'::jsonb,
          staff_active = true,
          staff_title = null,
          updated_at = now()
        WHERE id = ${id}
      `;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
