/**
 * Send transactional email via Resend REST API.
 * Set RESEND_API_KEY and EMAIL_FROM in Vercel environment variables.
 */
export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — email skipped for:', to);
    return;
  }
  const from = process.env.EMAIL_FROM || "Heaven's Boutique <orders@heavensboutique.com>";
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[email] Resend error', res.status, body.slice(0, 300));
    }
  } catch (e) {
    console.error('[email] sendEmail failed:', e.message);
  }
}
