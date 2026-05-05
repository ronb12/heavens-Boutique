import { getDb } from '../../lib/db.js';
import { requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import { getStripePublishableKey } from '../../lib/stripeCredentials.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireStoreAccess(req, PERM.SETTINGS);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const publishableKey = await getStripePublishableKey(sql);
      const rows = await sql`
        SELECT secret_key, webhook_secret FROM stripe_settings WHERE id = 1 LIMIT 1
      `;
      const row = rows[0];
      const hasSecretKey =
        Boolean(process.env.STRIPE_SECRET_KEY?.trim()) ||
        Boolean(row?.secret_key && String(row.secret_key).trim());
      const hasWebhookSecret =
        Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()) ||
        Boolean(row?.webhook_secret && String(row.webhook_secret).trim());
      const envOverridesSecret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
      const envOverridesWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());

      return json(res, 200, {
        publishableKey,
        hasSecretKey,
        hasWebhookSecret,
        envOverridesSecret,
        envOverridesWebhook,
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const rows = await sql`SELECT * FROM stripe_settings WHERE id = 1 LIMIT 1`;
      const cur = rows[0] || {};

      let publishableKey = cur.publishable_key ?? null;
      let secretKey = cur.secret_key ?? null;
      let webhookSecret = cur.webhook_secret ?? null;

      if (body.publishableKey !== undefined) {
        const v = String(body.publishableKey).trim();
        publishableKey = v || null;
      }
      if (body.secretKey !== undefined) {
        const v = String(body.secretKey).trim();
        secretKey = v || null;
      }
      if (body.webhookSecret !== undefined) {
        const v = String(body.webhookSecret).trim();
        webhookSecret = v || null;
      }

      await sql`
        INSERT INTO stripe_settings (id, publishable_key, secret_key, webhook_secret, updated_at)
        VALUES (1, ${publishableKey}, ${secretKey}, ${webhookSecret}, now())
        ON CONFLICT (id) DO UPDATE SET
          publishable_key = EXCLUDED.publishable_key,
          secret_key = EXCLUDED.secret_key,
          webhook_secret = EXCLUDED.webhook_secret,
          updated_at = now()
      `;

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 500, {
        error: 'Database missing stripe_settings table. Run migration 008_stripe_settings.sql.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
