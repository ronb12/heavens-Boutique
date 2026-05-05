import { getDb } from '../../lib/db.js';
import { json, readJson, handleCors, withCorsContext } from '../../lib/http.js';

/**
 * POST /api/newsletter/subscribe — public storefront footer signup.
 * Body: { email, source?: string }
 *
 * - If a customer account exists with this email: ensures `marketing_emails` is on users.tags
 *   (same audience as iOS Admin → Marketing subscribers).
 * - Always upserts newsletter_signups for guests (and audit / re-confirms).
 */
async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req);
    const raw = String(body.email || '')
      .trim()
      .toLowerCase();
    const source = String(body.source || 'footer').trim().slice(0, 64) || 'footer';

    if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      return json(res, 400, { error: 'Enter a valid email address.' });
    }

    const sql = getDb();

    let linkedAccount = false;
    const userRows = await sql`
      SELECT id, role, tags FROM users WHERE lower(trim(email)) = ${raw} LIMIT 1
    `;
    const u = userRows[0];

    if (u && u.role === 'customer') {
      linkedAccount = true;
      const prev = u.tags;
      const tags = Array.isArray(prev) ? [...prev] : [];
      if (!tags.includes('marketing_emails')) {
        tags.push('marketing_emails');
        await sql`UPDATE users SET tags = ${tags}, updated_at = now() WHERE id = ${u.id}`;
      }
    }

    try {
      await sql`
        INSERT INTO newsletter_signups (email_normalized, source)
        VALUES (${raw}, ${source})
        ON CONFLICT (email_normalized) DO UPDATE SET updated_at = now(), source = EXCLUDED.source
      `;
    } catch (insErr) {
      const msg = String(insErr?.message || insErr || '');
      const missing =
        insErr?.code === '42P01' ||
        /relation ["']?newsletter_signups["']? does not exist/i.test(msg);
      if (missing) {
        return json(res, 503, {
          error: 'Newsletter signup is not configured yet. Run migration 023_newsletter_signups.sql.',
        });
      }
      throw insErr;
    }

    return json(res, 200, {
      ok: true,
      linkedAccount,
      message: linkedAccount
        ? "You're subscribed to boutique news and offers."
        : "Thanks — we'll send new arrivals and offers to your inbox.",
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Something went wrong. Try again later.' });
  }
}
export default withCorsContext(handler);
