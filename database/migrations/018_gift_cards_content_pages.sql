-- Gift cards (store credit codes), CMS pages + blog posts, order gift-card debit tracking

CREATE TABLE IF NOT EXISTS gift_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash       TEXT NOT NULL UNIQUE,
  balance_cents   INTEGER NOT NULL CHECK (balance_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'usd',
  recipient_email TEXT,
  internal_note   TEXT,
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_active ON gift_cards(active) WHERE active = true;

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id             UUID NOT NULL REFERENCES gift_cards(id),
  order_id                 UUID REFERENCES orders(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents             INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gcr_card ON gift_card_redemptions(gift_card_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gift_card_debit_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS content_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  excerpt       TEXT,
  kind          TEXT NOT NULL DEFAULT 'page' CHECK (kind IN ('page', 'blog')),
  published     BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_pages_published ON content_pages(published, kind);

INSERT INTO content_pages (slug, title, body, excerpt, kind, published, published_at)
VALUES
  (
    'about',
    'About Heaven''s Boutique',
    E'A curated boutique experience—warm service, thoughtful pieces, and checkout you can trust.\n\nThis page can be edited in Admin → Pages.',
    'Our story.',
    'page',
    true,
    now()
  ),
  (
    'shipping',
    'Shipping policy',
    E'Standard, express, and priority shipping tiers are calculated at checkout. You will receive tracking information when your order ships.\n\nEdit this text in Admin → Pages.',
    'How we ship.',
    'page',
    true,
    now()
  ),
  (
    'returns',
    'Returns policy',
    E'We want you to love every purchase. Request a return from your account within the eligible window described at checkout.\n\nEdit this text in Admin → Pages.',
    'How returns work.',
    'page',
    true,
    now()
  )
ON CONFLICT (slug) DO NOTHING;
