import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

/** Derives a 32-byte key from env or JWT secret (override with GIFT_CARD_CODE_ENCRYPTION_KEY in production). */
function deriveKey() {
  const explicit = process.env.GIFT_CARD_CODE_ENCRYPTION_KEY;
  const raw =
    typeof explicit === 'string' && explicit.trim().length >= 32 ? explicit.trim() : process.env.JWT_SECRET || 'dev-only-change-me';
  return crypto.createHash('sha256').update(String(raw), 'utf8').digest();
}

/**
 * Persistable ciphertext for support recovery — do not expose to clients except admin reveal.
 * @param {string} plain e.g. HB-A1B2-C3D4
 */
export function encryptGiftCardCodeForStorage(plain) {
  const normalized = String(plain || '').trim();
  if (!normalized) return null;
  try {
    const key = deriveKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  } catch (e) {
    console.error('[giftCardCodeCipher] encrypt failed', e?.message);
    return null;
  }
}

/**
 * @param {string|null|undefined} blob base64 from DB
 * @returns {string|null}
 */
export function decryptGiftCardCodeFromStorage(blob) {
  if (!blob || typeof blob !== 'string') return null;
  try {
    const key = deriveKey();
    const buf = Buffer.from(blob, 'base64');
    if (buf.length < 12 + 16) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return out || null;
  } catch {
    return null;
  }
}
