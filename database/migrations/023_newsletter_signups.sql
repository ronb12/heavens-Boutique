-- Guest / footer newsletter interest list (normalized email).
-- Existing customers get `marketing_emails` on users.tags via API; guests stay here until they register.

CREATE TABLE IF NOT EXISTS newsletter_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_normalized TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'footer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_signups_email_normalized_key
  ON newsletter_signups (email_normalized);

COMMENT ON TABLE newsletter_signups IS
  'Emails collected from storefront footer etc.; merge into users.tags on signup when email matches.';
