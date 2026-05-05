-- Boutique-wide toggles (single row).
CREATE TABLE IF NOT EXISTS store_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gift_cards_purchase_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO store_settings (id, gift_cards_purchase_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;
