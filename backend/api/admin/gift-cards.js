import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import {
  generateGiftCardCode,
  hashGiftCardCode,
  normalizeGiftCardCode,
} from '../../lib/giftCard.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return json(res, auth.status, { error: auth.error });

    const sql = getDb();
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, balance_cents, currency, recipient_email, internal_note,
               expires_at, active, created_at, updated_at
        FROM gift_cards
        ORDER BY created_at DESC
        LIMIT 200
      `;
      return json(res, 200, {
        giftCards: rows.map((r) => ({
          id: r.id,
          balanceCents: r.balance_cents,
          currency: r.currency,
          recipientEmail: r.recipient_email,
          internalNote: r.internal_note,
          expiresAt: r.expires_at,
          active: r.active,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const amount = Number(body.initialBalanceCents ?? body.balanceCents);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 5000000) {
        return json(res, 400, { error: 'initialBalanceCents must be between 1 and 5000000 ($50k)' });
      }

      let plain = body.code ? normalizeGiftCardCode(body.code) : '';
      if (plain && plain.length < 8) {
        return json(res, 400, { error: 'Custom codes must be at least 8 characters.' });
      }
      if (!plain) {
        // Generate unique plain code (retry if hash collision).
        for (let i = 0; i < 8; i++) {
          const candidate = generateGiftCardCode();
          const h = hashGiftCardCode(candidate);
          const exists = await sql`SELECT 1 FROM gift_cards WHERE code_hash = ${h} LIMIT 1`;
          if (!exists[0]) {
            plain = candidate;
            break;
          }
        }
        if (!plain) return json(res, 500, { error: 'Could not generate a unique code' });
      }

      const codeHash = hashGiftCardCode(plain);
      const dup = await sql`SELECT id FROM gift_cards WHERE code_hash = ${codeHash} LIMIT 1`;
      if (dup[0]) return json(res, 409, { error: 'That code already exists.' });

      const recipientEmail = body.recipientEmail ? String(body.recipientEmail).trim().slice(0, 320) : null;
      const internalNote = body.internalNote ? String(body.internalNote).trim().slice(0, 2000) : null;
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

      await sql`
        INSERT INTO gift_cards (code_hash, balance_cents, recipient_email, internal_note, expires_at)
        VALUES (${codeHash}, ${Math.floor(amount)}, ${recipientEmail}, ${internalNote}, ${expiresAt})
      `;

      return json(res, 201, {
        ok: true,
        code: plain,
        message: 'Save this code now — it cannot be shown again.',
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (msg.includes('DATABASE_URL')) {
      return json(res, 500, { error: 'Server misconfigured: database URL missing.' });
    }
    const missingRelation =
      e?.code === '42P01' || /relation ["']?gift_cards["']? does not exist/i.test(msg);
    if (missingRelation) {
      return json(res, 500, {
        error: 'Database missing gift_cards table. Run migration 018_gift_cards_content_pages.sql.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
