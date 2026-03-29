import * as jose from 'jose';
import { createHash } from 'node:crypto';

const APPLE_ISSUER = 'https://appleid.apple.com';
const jwks = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export function syntheticEmailFromSub(sub) {
  const h = createHash('sha256').update(String(sub)).digest('hex').slice(0, 32);
  return `apple_${h}@signin.heavens-boutique`;
}

/**
 * @param {string} rawJwt
 * @param {{ audience: string, rawNonce?: string }} opts
 */
export async function verifyAppleIdentityToken(rawJwt, { audience, rawNonce }) {
  const { payload } = await jose.jwtVerify(rawJwt, jwks, {
    issuer: APPLE_ISSUER,
    audience,
  });
  if (rawNonce) {
    const expected = createHash('sha256').update(rawNonce).digest('hex');
    if (payload.nonce !== expected) {
      const err = new Error('Invalid nonce');
      err.code = 'APPLE_NONCE';
      throw err;
    }
  }
  return payload;
}
