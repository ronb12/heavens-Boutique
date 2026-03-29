-- Align column comment with profit guard (net after estimated card fees vs cost).
COMMENT ON COLUMN products.cost_cents IS 'Wholesale/unit cost in cents; optional. When set, lowest list/sale price must yield net revenue after estimated card fees (PROFIT_GUARD_CARD_* env) >= this cost.';
