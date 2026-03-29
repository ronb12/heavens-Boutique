-- Unit cost for admin profit checks (never exposed to shoppers in public API responses).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0);

COMMENT ON COLUMN products.cost_cents IS 'Wholesale/unit cost in cents; optional. When set, list/sale prices must not go below this.';
