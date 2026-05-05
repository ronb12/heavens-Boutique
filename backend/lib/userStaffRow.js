/**
 * Staff columns (`staff_permissions`, `staff_active`) were added in migration 022.
 * If that migration has not been applied yet, fall back to narrower SELECTs so login
 * and auth still work — operators should run `database/migrations/022_staff_roles_permissions.sql`.
 */

/** @param {unknown} e */
export function isMissingStaffColumnsError(e) {
  const code = e?.code;
  const msg = String(e?.message || '');
  if (code !== '42703') return false;
  return /staff_permissions|staff_active/i.test(msg);
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} sql
 * @param {string} email
 */
export async function selectUserForLoginByEmail(sql, email) {
  try {
    return await sql`
      SELECT id, email, password_hash, full_name, role, loyalty_points, fcm_token,
             staff_permissions, staff_active, staff_title
      FROM users WHERE email = ${email} LIMIT 1`;
  } catch (e) {
    const msg = String(e?.message || '');
    if (e?.code === '42703' && /staff_title/i.test(msg)) {
      return await sql`
        SELECT id, email, password_hash, full_name, role, loyalty_points, fcm_token,
               staff_permissions, staff_active
        FROM users WHERE email = ${email} LIMIT 1`;
    }
    if (!isMissingStaffColumnsError(e)) throw e;
    const rows = await sql`
      SELECT id, email, password_hash, full_name, role, loyalty_points, fcm_token
      FROM users WHERE email = ${email} LIMIT 1`;
    const row = rows[0];
    if (!row) return [];
    return [{ ...row, staff_permissions: {}, staff_active: true, staff_title: null }];
  }
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} sql
 * @param {string} userId
 */
export async function selectUserProfileById(sql, userId) {
  try {
    return await sql`
      SELECT id, email, full_name, phone, role, loyalty_points, tags, created_at,
             staff_permissions, staff_active, staff_title
      FROM users WHERE id = ${userId} LIMIT 1`;
  } catch (e) {
    const msg = String(e?.message || '');
    if (e?.code === '42703' && /staff_title/i.test(msg)) {
      return await sql`
        SELECT id, email, full_name, phone, role, loyalty_points, tags, created_at,
               staff_permissions, staff_active
        FROM users WHERE id = ${userId} LIMIT 1`;
    }
    if (!isMissingStaffColumnsError(e)) throw e;
    const rows = await sql`
      SELECT id, email, full_name, phone, role, loyalty_points, tags, created_at
      FROM users WHERE id = ${userId} LIMIT 1`;
    const row = rows[0];
    if (!row) return [];
    return [{ ...row, staff_permissions: {}, staff_active: true, staff_title: null }];
  }
}

/**
 * @param {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} sql
 * @param {string} userId
 */
export async function selectStaffFieldsByUserId(sql, userId) {
  try {
    return await sql`
      SELECT role, staff_permissions, staff_active FROM users WHERE id = ${userId} LIMIT 1`;
  } catch (e) {
    if (!isMissingStaffColumnsError(e)) throw e;
    const rows = await sql`SELECT role FROM users WHERE id = ${userId} LIMIT 1`;
    const row = rows[0];
    if (!row) return [];
    return [{ role: row.role, staff_permissions: {}, staff_active: true }];
  }
}
