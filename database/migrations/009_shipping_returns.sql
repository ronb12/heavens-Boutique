-- 009: EasyPost shipping label columns on orders, address name, variant weight, and returns table

-- Recipient name for EasyPost (shippers need a name on the label)
ALTER TABLE user_addresses
  ADD COLUMN IF NOT EXISTS name TEXT;


ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS easypost_shipment_id  TEXT,
  ADD COLUMN IF NOT EXISTS easypost_tracker_id   TEXT,
  ADD COLUMN IF NOT EXISTS label_url             TEXT,
  ADD COLUMN IF NOT EXISTS carrier               TEXT,
  ADD COLUMN IF NOT EXISTS service               TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_status    TEXT NOT NULL DEFAULT 'unfulfilled',
  ADD COLUMN IF NOT EXISTS shipping_tier         TEXT;

-- Per-variant weight for shipping rate calculation (default 8 oz)
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS weight_oz NUMERIC(8,2) NOT NULL DEFAULT 8;

CREATE TABLE IF NOT EXISTS returns (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID        NOT NULL REFERENCES orders(id),
  user_id                 UUID        REFERENCES users(id),
  reason                  TEXT        NOT NULL,
  notes                   TEXT,
  status                  TEXT        NOT NULL DEFAULT 'pending',
  items                   JSONB       NOT NULL DEFAULT '[]',
  easypost_return_id      TEXT,
  return_label_url        TEXT,
  admin_notes             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS returns_order_id_idx ON returns(order_id);
CREATE INDEX IF NOT EXISTS returns_user_id_idx  ON returns(user_id);
