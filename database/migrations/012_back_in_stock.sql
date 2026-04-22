-- 012: Back-in-stock subscriptions

CREATE TABLE IF NOT EXISTS back_in_stock_subscriptions (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_back_in_stock_variant ON back_in_stock_subscriptions(variant_id);

