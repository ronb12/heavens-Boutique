import { getDb } from '../lib/db.js';
import { json, handleCors, withCorsContext } from '../lib/http.js';
import { isGiftCardPurchaseEnabled } from '../lib/storeSettings.js';

/** Public read-only store flags for the storefront. */
async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const sql = getDb();
  try {
    const giftCardsPurchaseEnabled = await isGiftCardPurchaseEnabled(sql);
    const envForcedOff = String(process.env.GIFT_CARDS_PURCHASE_DISABLED || '').toLowerCase() === 'true';
    return json(
      res,
      200,
      {
        giftCardsPurchaseEnabled,
        giftCardsPurchaseDisabledByEnv: envForcedOff,
      },
      { 'Cache-Control': 'public, max-age=0, must-revalidate' },
    );
  } catch (e) {
    console.error(e);
    return json(
      res,
      200,
      {
        giftCardsPurchaseEnabled: true,
        giftCardsPurchaseDisabledByEnv: false,
      },
      { 'Cache-Control': 'public, max-age=0, must-revalidate' },
    );
  }
}
export default withCorsContext(handler);
