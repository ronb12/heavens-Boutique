-- Single-row store for Stripe keys set from the admin app. Vercel env vars still win when set.
CREATE TABLE stripe_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  publishable_key TEXT,
  secret_key TEXT,
  webhook_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
