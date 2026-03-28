-- Allow marking orders refunded after processing refund in Stripe Dashboard (see README).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'));

COMMENT ON COLUMN orders.status IS
  'Fulfillment lifecycle. Use refunded after issuing a refund in Stripe; restock inventory manually if needed.';
