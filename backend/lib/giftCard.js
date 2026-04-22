import crypto from 'node:crypto';

/** Normalize user input: trim, uppercase, remove spaces/dashes inconsistency — keep alphanumeric + dash */
export function normalizeGiftCardCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '');
}

export function hashGiftCardCode(normalized) {
  return crypto.createHash('sha256').update(String(normalized || ''), 'utf8').digest('hex');
}

export function generateGiftCardCode() {
  const a = crypto.randomBytes(3).toString('hex').toUpperCase();
  const b = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `HB-${a}-${b}`;
}
