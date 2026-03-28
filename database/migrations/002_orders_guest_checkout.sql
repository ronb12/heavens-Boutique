-- Guest checkout: orders may exist without a user account (email on order for fulfillment).
ALTER TABLE orders
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

COMMENT ON COLUMN orders.guest_email IS 'Set for guest checkout when user_id is null; used for receipts and support.';
