import { getDb } from '../lib/db.js';
import { json, readJson, handleCors } from '../lib/http.js';
import { hashGiftCardCode, normalizeGiftCardCode } from '../lib/giftCard.js';

/**
 * POST /api/gift-cards — check balance for a code (public; rate-limit in production).
 * Body: { code }
 */
export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req);
    const normalized = normalizeGiftCardCode(body.code);
    if (!normalized || normalized.length < 6) {
      return json(res, 400, { error: 'Enter a valid gift card code.' });
    }
    const codeHash = hashGiftCardCode(normalized);
    const sql = getDb();
    const rows = await sql`
      SELECT id, balance_cents, active, expires_at
      FROM gift_cards
      WHERE code_hash = ${codeHash}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || !row.active) {
      return json(res, 200, { ok: false, balanceCents: 0, message: 'Code not found or inactive.' });
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return json(res, 200, { ok: false, balanceCents: 0, message: 'This gift card has expired.' });
    }
    return json(res, 200, {
      ok: true,
      balanceCents: Number(row.balance_cents) || 0,
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
