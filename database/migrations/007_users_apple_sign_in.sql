-- Sign in with Apple: link Apple subject to users; allow passwordless rows.
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users (apple_sub) WHERE apple_sub IS NOT NULL;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_or_apple;
ALTER TABLE users ADD CONSTRAINT users_password_or_apple CHECK (
  password_hash IS NOT NULL OR apple_sub IS NOT NULL
);
