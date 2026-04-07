/**
 * Stripe API keys: `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` in env take precedence;
 * otherwise values from `stripe_settings` (admin UI) are used.
 */

/** @param {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} sql */
export async function getStripeSecretKey(sql) {
  const env = process.env.STRIPE_SECRET_KEY?.trim();
  if (env) return env;
  const rows = await sql`SELECT secret_key FROM stripe_settings WHERE id = 1 LIMIT 1`;
  const k = rows[0]?.secret_key && String(rows[0].secret_key).trim();
  return k || '';
}

/** @param {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} sql */
export async function getStripeWebhookSecret(sql) {
  const env = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (env) return env;
  const rows = await sql`SELECT webhook_secret FROM stripe_settings WHERE id = 1 LIMIT 1`;
  const k = rows[0]?.webhook_secret && String(rows[0].webhook_secret).trim();
  return k || '';
}

/** Publishable key for clients (no env name in backend today). */
/** @param {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} sql */
export async function getStripePublishableKey(sql) {
  const rows = await sql`SELECT publishable_key FROM stripe_settings WHERE id = 1 LIMIT 1`;
  const k = rows[0]?.publishable_key && String(rows[0].publishable_key).trim();
  return k || '';
}
