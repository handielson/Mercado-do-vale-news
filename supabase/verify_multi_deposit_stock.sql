-- Multi-deposit stock post-migration verification
-- Run after supabase/migrations/20260509000001_multi_deposit_stock.sql.
-- This script is read-only except for temporary CTEs and raises an error when a required object is missing.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_deposits') THEN
    RAISE EXCEPTION 'missing table: stock_deposits';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_locations') THEN
    RAISE EXCEPTION 'missing table: stock_locations';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_stock_locations') THEN
    RAISE EXCEPTION 'missing table: product_stock_locations';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_location_movements') THEN
    RAISE EXCEPTION 'missing table: stock_location_movements';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'stock_location_divergences') THEN
    RAISE EXCEPTION 'missing view: stock_location_divergences';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_product_stock_by_priority') THEN
    RAISE EXCEPTION 'missing function: decrement_product_stock_by_priority';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reserve_product_stock_by_priority') THEN
    RAISE EXCEPTION 'missing function: reserve_product_stock_by_priority';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'consume_order_stock_reservations') THEN
    RAISE EXCEPTION 'missing function: consume_order_stock_reservations';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'release_order_stock_reservations') THEN
    RAISE EXCEPTION 'missing function: release_order_stock_reservations';
  END IF;
END;
$$;

SELECT
  'stock_deposits' AS object_name,
  COUNT(*) AS row_count
FROM stock_deposits
UNION ALL
SELECT
  'stock_locations',
  COUNT(*)
FROM stock_locations
UNION ALL
SELECT
  'product_stock_locations',
  COUNT(*)
FROM product_stock_locations
UNION ALL
SELECT
  'stock_location_movements',
  COUNT(*)
FROM stock_location_movements;

SELECT
  p.company_id,
  COUNT(*) FILTER (WHERE sd.is_default) AS default_deposit_count,
  COUNT(*) FILTER (WHERE sl.is_default) AS default_location_count
FROM products p
LEFT JOIN stock_deposits sd ON sd.company_id = p.company_id
LEFT JOIN stock_locations sl ON sl.company_id = p.company_id AND sl.deposit_id = sd.id
GROUP BY p.company_id
ORDER BY p.company_id;

SELECT
  COUNT(*) AS divergent_products
FROM stock_location_divergences
WHERE difference <> 0;

SELECT
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'add_product_stock_location',
    'adjust_product_stock_location',
    'transfer_product_stock_location',
    'decrement_product_stock_by_priority',
    'reserve_product_stock_by_priority',
    'consume_order_stock_reservations',
    'release_order_stock_reservations',
    'restore_product_stock_from_sale_movements',
    'restore_product_stock_from_order_movements'
  )
ORDER BY routine_name;
