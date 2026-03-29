import { GoogleAuth } from 'google-auth-library';

/**
 * Send FCM via HTTP v1.
 * Prefers `FCM_SERVICE_ACCOUNT_JSON` (full service account JSON) to mint short-lived tokens.
 * Falls back to static `FCM_ACCESS_TOKEN` if set.
 */
let tokenCache = { accessToken: null, expiresAtMs: 0 };

async function getFcmBearerToken() {
  const jsonRaw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (jsonRaw?.trim()) {
    const now = Date.now();
    if (tokenCache.accessToken && tokenCache.expiresAtMs > now + 60_000) {
      return tokenCache.accessToken;
    }
    let credentials;
    try {
      credentials = JSON.parse(jsonRaw);
    } catch {
      return null;
    }
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const res = await client.getAccessToken();
    const tok = res?.token;
    if (!tok) return null;
    tokenCache = { accessToken: tok, expiresAtMs: now + 50 * 60 * 1000 };
    return tok;
  }
  const t = process.env.FCM_ACCESS_TOKEN?.trim();
  return t || null;
}

export async function sendPushToToken({ token, title, body, data }) {
  const projectId = process.env.FCM_PROJECT_ID?.trim();
  const bearer = await getFcmBearerToken();
  if (!token || !projectId || !bearer) {
    return { skipped: true };
  }
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const message = {
    message: {
      token,
      notification: { title, body },
      data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
      apns: {
        payload: { aps: { sound: 'default' } },
      },
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(message),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: t };
  }
  return { ok: true };
}
