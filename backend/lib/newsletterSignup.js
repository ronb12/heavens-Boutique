/**
 * If this email joined the footer list before registering, opt them into marketing_emails
 * so iOS Admin “marketing subscribers” broadcasts include them.
 */
export async function applyNewsletterInterestOnSignup(sql, emailNormalized, userId) {
  const ns = await sql`
    SELECT 1 FROM newsletter_signups WHERE email_normalized = ${emailNormalized} LIMIT 1
  `;
  if (!ns[0]) return;

  const rows = await sql`SELECT tags FROM users WHERE id = ${userId} LIMIT 1`;
  const prev = rows[0]?.tags;
  const tags = Array.isArray(prev) ? [...prev] : [];
  if (!tags.includes('marketing_emails')) tags.push('marketing_emails');
  await sql`UPDATE users SET tags = ${tags}, updated_at = now() WHERE id = ${userId}`;
}
