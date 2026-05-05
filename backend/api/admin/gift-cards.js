import { getDb } from '../../lib/db.js';
import { requireStoreAccess, PERM } from '../../lib/auth.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';
import {
  generateGiftCardCode,
  hashGiftCardCode,
  normalizeGiftCardCode,
} from '../../lib/giftCard.js';
import {
  encryptGiftCardCodeForStorage,
  decryptGiftCardCodeFromStorage,
} from '../../lib/giftCardCodeCipher.js';
import { sendGiftCardReplacementEmail } from '../../lib/emailTemplates.js';

function isGiftCardUuid(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
  );
}

function mapListRow(r) {
  return {
    id: r.id,
    balanceCents: r.balance_cents,
    currency: r.currency,
    recipientEmail: r.recipient_email,
    internalNote: r.internal_note,
    expiresAt: r.expires_at,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    recoveryAvailable: Boolean(r.recovery_available),
  };
}

async function handler(req, res, segmentsArg = []) {
  if (handleCors(req, res)) return;
  try {
    const auth = await requireStoreAccess(req, PERM.GIFT_CARDS);
    if (auth.error) return json(res, auth.status, { error: auth.error });

    const sql = getDb();

    /** This file is mounted at `/api/admin/gift-cards`; Vercel does not pass catch-all segments—only (req, res). */
    const segments = Array.isArray(segmentsArg) && segmentsArg.length > 0 ? segmentsArg : ['gift-cards'];

    if (segments.length > 3 || segments[0] !== 'gift-cards') {
      return json(res, 404, { error: 'Not found' });
    }

    const cardId = segments[1];
    const action = segments[2];

    if (segments.length === 3 && action !== 'reissue') {
      return json(res, 404, { error: 'Not found' });
    }

    if (cardId && action === 'reissue') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      if (!isGiftCardUuid(cardId)) return json(res, 400, { error: 'Invalid gift card id' });

      const body = await readJson(req);
      const sendEmail = body?.sendEmail !== false;

      const existing = await sql`
        SELECT id, balance_cents, recipient_email, active
        FROM gift_cards WHERE id = ${cardId} LIMIT 1
      `;
      if (!existing[0]) return json(res, 404, { error: 'Gift card not found' });
      const row = existing[0];

      let plain = '';
      for (let i = 0; i < 12; i++) {
        const candidate = generateGiftCardCode();
        const h = hashGiftCardCode(candidate);
        const clash = await sql`
          SELECT 1 FROM gift_cards WHERE code_hash = ${h} AND id <> ${cardId} LIMIT 1
        `;
        if (!clash[0]) {
          plain = candidate;
          break;
        }
      }
      if (!plain) return json(res, 500, { error: 'Could not generate a unique replacement code' });

      const newHash = hashGiftCardCode(plain);
      const cipher = encryptGiftCardCodeForStorage(plain);
      if (!cipher) return json(res, 500, { error: 'Could not encrypt replacement code.' });

      await sql`
        UPDATE gift_cards
        SET code_hash = ${newHash},
            code_cipher = ${cipher},
            updated_at = now()
        WHERE id = ${cardId}
      `;

      let emailed = false;
      const em = row.recipient_email ? String(row.recipient_email).trim().toLowerCase() : '';
      if (sendEmail && em && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        try {
          await sendGiftCardReplacementEmail({
            to: em,
            code: plain,
            balanceCents: row.balance_cents,
          });
          emailed = true;
        } catch (e) {
          console.error('[gift card reissue] email', e);
        }
      }

      return json(res, 200, {
        ok: true,
        code: plain,
        emailed,
        message: emailed
          ? 'New code emailed to the recipient address on file.'
          : sendEmail && !em
            ? 'No recipient email on file — copy the new code below and give it to the customer.'
            : 'Replacement code generated (email skipped).',
      });
    }

    if (cardId && !action) {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
      if (!isGiftCardUuid(cardId)) return json(res, 400, { error: 'Invalid gift card id' });

      const rows = await sql`
        SELECT id, balance_cents, currency, recipient_email, internal_note,
               expires_at, active, created_at, updated_at, code_cipher
        FROM gift_cards WHERE id = ${cardId} LIMIT 1
      `;
      if (!rows[0]) return json(res, 404, { error: 'Gift card not found' });
      const r = rows[0];
      const revealed = decryptGiftCardCodeFromStorage(r.code_cipher);

      return json(res, 200, {
        giftCard: mapListRow({
          ...r,
          recovery_available: Boolean(r.code_cipher),
        }),
        revealedCode: revealed,
        legacyNoCipher: !r.code_cipher,
      });
    }

    if (segments.length !== 1) {
      return json(res, 404, { error: 'Not found' });
    }

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, balance_cents, currency, recipient_email, internal_note,
               expires_at, active, created_at, updated_at,
               (code_cipher IS NOT NULL AND length(trim(code_cipher)) > 0) AS recovery_available
        FROM gift_cards
        ORDER BY created_at DESC
        LIMIT 200
      `;
      return json(res, 200, {
        giftCards: rows.map(mapListRow),
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

      const codeCipher = encryptGiftCardCodeForStorage(plain);
      if (!codeCipher) {
        return json(res, 500, { error: 'Could not encrypt gift card code for storage. Check server configuration.' });
      }

      await sql`
        INSERT INTO gift_cards (code_hash, code_cipher, balance_cents, recipient_email, internal_note, expires_at)
        VALUES (${codeHash}, ${codeCipher}, ${Math.floor(amount)}, ${recipientEmail}, ${internalNote}, ${expiresAt})
      `;

      return json(res, 201, {
        ok: true,
        code: plain,
        message: 'Save or copy this code now. You can reveal it anytime from the card list.',
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (msg.includes('DATABASE_URL')) {
      return json(res, 500, { error: 'Server misconfigured: database URL missing.' });
    }
    const missingCol =
      e?.code === '42703' ||
      (/column .* does not exist/i.test(msg) && /code_cipher/i.test(msg));
    if (missingCol) {
      return json(res, 500, {
        error: 'Database missing code_cipher column. Run migration 026_gift_card_code_recovery.sql.',
      });
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

export default withCorsContext(handler);
