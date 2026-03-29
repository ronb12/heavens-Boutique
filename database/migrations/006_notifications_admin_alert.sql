-- Allow store alerts for admin accounts (new order, low stock, new signup).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'order',
    'promotion',
    'back_in_stock',
    'abandoned_cart',
    'message',
    'admin_alert'
  )
);
