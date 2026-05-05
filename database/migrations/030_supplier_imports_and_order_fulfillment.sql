-- 030: Supplier import queue + dropship fulfillment tracking.

CREATE TABLE IF NOT EXISTS product_import_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'published', 'archived')),
  supplier_name TEXT,
  supplier_url TEXT NOT NULL,
  title TEXT,
  boutique_name TEXT,
  category TEXT,
  description TEXT,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  sale_price_cents INTEGER CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0),
  cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
  image_urls TEXT[] DEFAULT '{}',
  sizes TEXT[] DEFAULT '{}',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  ships_from TEXT,
  delivery_days_min INTEGER CHECK (delivery_days_min IS NULL OR delivery_days_min >= 0),
  delivery_days_max INTEGER CHECK (delivery_days_max IS NULL OR delivery_days_max >= 0),
  backup_supplier_url TEXT,
  notes TEXT,
  published_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_import_queue_status ON product_import_queue(status);
CREATE INDEX IF NOT EXISTS idx_product_import_queue_created_at ON product_import_queue(created_at DESC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS supplier_order_status TEXT NOT NULL DEFAULT 'not_needed',
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS supplier_order_url TEXT,
  ADD COLUMN IF NOT EXISTS supplier_order_number TEXT,
  ADD COLUMN IF NOT EXISTS supplier_tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_supplier_order_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_supplier_order_status_check
      CHECK (supplier_order_status IN ('not_needed', 'needs_order', 'ordered', 'supplier_shipped', 'received', 'cancelled'));
  END IF;
END $$;
