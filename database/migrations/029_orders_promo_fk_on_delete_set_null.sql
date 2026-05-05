-- Allow deleting promo_codes when orders still reference them (keep orders; drop FK link).

BEGIN;

DO $migration$
DECLARE
  cname text;
BEGIN
  SELECT tc.constraint_name INTO cname
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'orders'
    AND kcu.column_name = 'promo_code_id'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', cname);
  END IF;
END;
$migration$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_promo_code_id_fkey
  FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;

COMMIT;
