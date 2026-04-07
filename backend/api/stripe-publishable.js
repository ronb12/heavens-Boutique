import { getDb } from '../lib/db.js';
import { json, handleCors } from '../lib/http.js';
import { getStripePublishableKey } from '../lib/stripeCredentials.js';

/** Public: publishable key for the mobile app (Info.plist fallback if empty). */
export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  try {
    const sql = getDb();
    const publishableKey = await getStripePublishableKey(sql);
    return json(res, 200, { publishableKey });
  } catch (e) {
    if (e.code === '42P01') {
      return json(res, 200, { publishableKey: '' });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
