import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

function envOverrides() {
  return {
    apiKey: Boolean(process.env.EASYPOST_API_KEY?.trim()),
    fromName: Boolean(process.env.EASYPOST_FROM_NAME?.trim()),
    fromStreet1: Boolean(process.env.EASYPOST_FROM_STREET1?.trim()),
    fromStreet2: Boolean(process.env.EASYPOST_FROM_STREET2?.trim()),
    fromCity: Boolean(process.env.EASYPOST_FROM_CITY?.trim()),
    fromState: Boolean(process.env.EASYPOST_FROM_STATE?.trim()),
    fromZip: Boolean(process.env.EASYPOST_FROM_ZIP?.trim()),
    fromPhone: Boolean(process.env.EASYPOST_FROM_PHONE?.trim()),
    fromEmail: Boolean(process.env.EASYPOST_FROM_EMAIL?.trim()),
  };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM easypost_settings WHERE id = 1 LIMIT 1`;
      const row = rows[0] || {};
      const env = envOverrides();

      const hasApiKey = Boolean(process.env.EASYPOST_API_KEY?.trim()) || Boolean(row.api_key && String(row.api_key).trim());

      return json(res, 200, {
        hasApiKey,
        envOverrides: env,
        from: {
          name: process.env.EASYPOST_FROM_NAME || row.from_name || "",
          street1: process.env.EASYPOST_FROM_STREET1 || row.from_street1 || "",
          street2: process.env.EASYPOST_FROM_STREET2 || row.from_street2 || "",
          city: process.env.EASYPOST_FROM_CITY || row.from_city || "",
          state: process.env.EASYPOST_FROM_STATE || row.from_state || "",
          zip: process.env.EASYPOST_FROM_ZIP || row.from_zip || "",
          phone: process.env.EASYPOST_FROM_PHONE || row.from_phone || "",
          email: process.env.EASYPOST_FROM_EMAIL || row.from_email || "",
        },
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const rows = await sql`SELECT * FROM easypost_settings WHERE id = 1 LIMIT 1`;
      const cur = rows[0] || {};

      let apiKey = cur.api_key ?? null;
      let fromName = cur.from_name ?? null;
      let fromStreet1 = cur.from_street1 ?? null;
      let fromStreet2 = cur.from_street2 ?? null;
      let fromCity = cur.from_city ?? null;
      let fromState = cur.from_state ?? null;
      let fromZip = cur.from_zip ?? null;
      let fromPhone = cur.from_phone ?? null;
      let fromEmail = cur.from_email ?? null;

      if (body.apiKey !== undefined) {
        const v = String(body.apiKey).trim();
        apiKey = v || null;
      }
      if (body.fromName !== undefined) fromName = String(body.fromName).trim() || null;
      if (body.fromStreet1 !== undefined) fromStreet1 = String(body.fromStreet1).trim() || null;
      if (body.fromStreet2 !== undefined) fromStreet2 = String(body.fromStreet2).trim() || null;
      if (body.fromCity !== undefined) fromCity = String(body.fromCity).trim() || null;
      if (body.fromState !== undefined) fromState = String(body.fromState).trim() || null;
      if (body.fromZip !== undefined) fromZip = String(body.fromZip).trim() || null;
      if (body.fromPhone !== undefined) fromPhone = String(body.fromPhone).trim() || null;
      if (body.fromEmail !== undefined) fromEmail = String(body.fromEmail).trim() || null;

      await sql`
        INSERT INTO easypost_settings (
          id, api_key, from_name, from_street1, from_street2, from_city, from_state, from_zip, from_phone, from_email, updated_at
        )
        VALUES (
          1, ${apiKey}, ${fromName}, ${fromStreet1}, ${fromStreet2}, ${fromCity}, ${fromState}, ${fromZip}, ${fromPhone}, ${fromEmail}, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          api_key = EXCLUDED.api_key,
          from_name = EXCLUDED.from_name,
          from_street1 = EXCLUDED.from_street1,
          from_street2 = EXCLUDED.from_street2,
          from_city = EXCLUDED.from_city,
          from_state = EXCLUDED.from_state,
          from_zip = EXCLUDED.from_zip,
          from_phone = EXCLUDED.from_phone,
          from_email = EXCLUDED.from_email,
          updated_at = now()
      `;

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 500, {
        error: 'Database missing easypost_settings table. Run migration 010_easypost_settings.sql.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

