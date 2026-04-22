/**
 * EasyPost API key and origin ("from") address.
 * Env vars override stored admin settings when set.
 */

const DEFAULT_FROM_NAME = "Heaven's Boutique";

/** @param {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} sql */
export async function getEasyPostApiKey(sql) {
  const env = process.env.EASYPOST_API_KEY?.trim();
  if (env) return env;
  try {
    const rows = await sql`SELECT api_key FROM easypost_settings WHERE id = 1 LIMIT 1`;
    const k = rows[0]?.api_key && String(rows[0].api_key).trim();
    return k || '';
  } catch (e) {
    // Allow env-only configuration even if migration hasn't been run yet.
    if (e?.code === '42P01') return '';
    throw e;
  }
}

/** @param {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} sql */
export async function getEasyPostFromAddress(sql) {
  let row = {};
  try {
    const rows = await sql`
      SELECT
        from_name, from_street1, from_street2, from_city, from_state, from_zip, from_phone, from_email
      FROM easypost_settings
      WHERE id = 1
      LIMIT 1
    `;
    row = rows[0] || {};
  } catch (e) {
    // Allow env-only configuration even if migration hasn't been run yet.
    if (e?.code !== '42P01') throw e;
  }

  return {
    name: process.env.EASYPOST_FROM_NAME || row.from_name || DEFAULT_FROM_NAME,
    street1: process.env.EASYPOST_FROM_STREET1 || row.from_street1 || '',
    street2: process.env.EASYPOST_FROM_STREET2 || row.from_street2 || undefined,
    city: process.env.EASYPOST_FROM_CITY || row.from_city || '',
    state: process.env.EASYPOST_FROM_STATE || row.from_state || '',
    zip: process.env.EASYPOST_FROM_ZIP || row.from_zip || '',
    country: 'US',
    phone: process.env.EASYPOST_FROM_PHONE || row.from_phone || '',
    email: process.env.EASYPOST_FROM_EMAIL || row.from_email || '',
  };
}

