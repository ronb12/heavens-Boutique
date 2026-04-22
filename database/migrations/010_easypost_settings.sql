-- 010: Single-row store for EasyPost API key + origin (from) address set from the admin app.
-- Vercel env vars still override when set.

CREATE TABLE easypost_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  api_key TEXT,
  from_name TEXT,
  from_street1 TEXT,
  from_street2 TEXT,
  from_city TEXT,
  from_state TEXT,
  from_zip TEXT,
  from_phone TEXT,
  from_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

