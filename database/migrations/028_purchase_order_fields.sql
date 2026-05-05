-- Extra purchase order header + line fields (terms, ship-to, quality spec)

BEGIN;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS ship_to TEXT;

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS quality_spec TEXT;

COMMIT;
