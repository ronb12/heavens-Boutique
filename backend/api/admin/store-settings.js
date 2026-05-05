import { getDb } from '../../lib/db.js';
import { requireStoreAccessAny, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';

/** Accept explicit false / null / "false" — only reject when the flag is absent. */
function parseGiftCardsPurchaseEnabled(body) {
  const hasCamel = Object.prototype.hasOwnProperty.call(body, 'giftCardsPurchaseEnabled');
  const hasSnake = Object.prototype.hasOwnProperty.call(body, 'gift_cards_purchase_enabled');
  if (!hasCamel && !hasSnake) return { error: 'giftCardsPurchaseEnabled is required' };

  const raw = hasCamel ? body.giftCardsPurchaseEnabled : body.gift_cards_purchase_enabled;
  if (raw === null || raw === undefined) {
    return { value: false };
  }
  if (typeof raw === 'boolean') return { value: raw };
  if (typeof raw === 'number') return { value: raw !== 0 };
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'off' || s === 'no' || s === '') return { value: false };
    if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return { value: true };
  }
  return { value: Boolean(raw) };
}

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireStoreAccessAny(req, [PERM.SETTINGS, PERM.GIFT_CARDS]);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT gift_cards_purchase_enabled FROM store_settings WHERE id = 1 LIMIT 1
      `;
      const enabled = rows[0]?.gift_cards_purchase_enabled !== false;
      return json(
        res,
        200,
        {
          giftCardsPurchaseEnabled: enabled,
          giftCardsPurchaseDisabledByEnv:
            String(process.env.GIFT_CARDS_PURCHASE_DISABLED || '').toLowerCase() === 'true',
        },
        {
          'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache',
        },
      );
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const body = await readJson(req);
      const parsed = parseGiftCardsPurchaseEnabled(body);
      if ('error' in parsed) {
        return json(res, 400, { error: parsed.error });
      }
      const on = parsed.value;

      await sql`
        INSERT INTO store_settings (id, gift_cards_purchase_enabled, updated_at)
        VALUES (1, ${on}, now())
        ON CONFLICT (id) DO UPDATE SET
          gift_cards_purchase_enabled = EXCLUDED.gift_cards_purchase_enabled,
          updated_at = now()
      `;

      return json(res, 200, { ok: true, giftCardsPurchaseEnabled: on });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    if (e?.code === '42P01') {
      return json(res, 500, {
        error: 'Database missing store_settings. Run migration 025_store_settings.sql.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
