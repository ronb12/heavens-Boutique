-- 013: Inventory audit log (stock deltas)

CREATE TABLE IF NOT EXISTS inventory_audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id    UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_variant ON inventory_audit(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_order ON inventory_audit(order_id);

