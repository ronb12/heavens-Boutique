/**
 * Send FCM via HTTP v1 (requires GOOGLE_APPLICATION_CREDENTIALS_JSON or service account env).
 * Falls back to no-op when not configured.
 */
export async function sendPushToToken({ token, title, body, data }) {
  if (!token || !process.env.FCM_PROJECT_ID || !process.env.FCM_ACCESS_TOKEN) {
    return { skipped: true };
  }
  const url = `https://fcm.googleapis.com/v1/projects/${process.env.FCM_PROJECT_ID}/messages:send`;
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
      Authorization: `Bearer ${process.env.FCM_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(message),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, error: t };
  }
  return { ok: true };
}
