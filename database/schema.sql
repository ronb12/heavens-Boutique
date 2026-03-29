-- Heaven's Boutique — Neon Postgres schema
-- Run once against your Neon database (SQL editor or psql).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ─────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  fcm_token     TEXT,
  tags          TEXT[] DEFAULT '{}',
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_addresses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT,
  line1      TEXT NOT NULL,
  line2      TEXT,
  city       TEXT NOT NULL,
  state      TEXT,
  postal     TEXT NOT NULL,
  country    TEXT NOT NULL DEFAULT 'US',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_addresses_user ON user_addresses(user_id);

-- ─── Products ───────────────────────────────────────────────────────
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  category    TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  sale_price_cents INTEGER CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0),
  cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  shop_look_group TEXT,
  cloudinary_ids TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = true;

CREATE TABLE product_variants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size        TEXT NOT NULL,
  sku         TEXT UNIQUE,
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, size)
);

CREATE INDEX idx_variants_product ON product_variants(product_id);

-- ─── Wishlist ───────────────────────────────────────────────────────
CREATE TABLE wishlist (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ─── Promo & loyalty ledger ─────────────────────────────────────────
CREATE TABLE promo_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_cents')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  max_uses      INTEGER,
  uses_count    INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loyalty_ledger (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     TEXT,
  order_id   UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_user ON loyalty_ledger(user_id);

-- ─── Carts (abandoned cart tracking) ────────────────────────────────
CREATE TABLE carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  guest_id   TEXT,
  items_json JSONB NOT NULL DEFAULT '[]',
  notified_1h   BOOLEAN NOT NULL DEFAULT false,
  notified_24h  BOOLEAN NOT NULL DEFAULT false,
  promo_hint TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

CREATE INDEX idx_carts_user ON carts(user_id);
CREATE INDEX idx_carts_updated ON carts(updated_at);

-- ─── Orders ─────────────────────────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_email     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal_cents  INTEGER NOT NULL,
  discount_cents  INTEGER NOT NULL DEFAULT 0,
  tax_cents       INTEGER NOT NULL DEFAULT 0,
  shipping_cents  INTEGER NOT NULL DEFAULT 0,
  total_cents     INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  shipping_address JSONB,
  tracking_number TEXT,
  promo_code_id   UUID REFERENCES promo_codes(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR (guest_email IS NOT NULL AND length(trim(guest_email)) > 0))
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id),
  variant_id  UUID NOT NULL REFERENCES product_variants(id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ─── Messaging ──────────────────────────────────────────────────────
CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id   UUID REFERENCES users(id),
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  title      TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_last ON conversations(last_message_at DESC NULLS LAST);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT,
  image_url       TEXT,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

-- ─── Notifications ──────────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
    CHECK (type IN ('order', 'promotion', 'back_in_stock', 'abandoned_cart', 'message')),
  title      TEXT NOT NULL,
  body       TEXT,
  data       JSONB,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- First admin: set ADMIN_EMAILS in Vercel / .env, or run:
--   cd backend && DATABASE_URL=... npm run seed:admin
-- (default seed:admin: heavenbowie0913@gmail.com / password1234 — change after first login.)
--
-- Full demo catalog + orders + messages + notifications (does not delete users):
--   cd backend && DATABASE_URL=... npm run seed:sample
