-- Fix get_catalog_statistics function
-- Replace the existing function with correct column names

CREATE OR REPLACE FUNCTION get_catalog_statistics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_products', (SELECT COUNT(*) FROM products),
    'total_categories', (SELECT COUNT(DISTINCT category_id) FROM products),
    'total_brands', (SELECT COUNT(DISTINCT brand) FROM products),
    'total_views', (SELECT COALESCE(SUM(views_count), 0) FROM products),
    'total_favorites', (SELECT COUNT(*) FROM customer_favorites),
    'total_shares', (SELECT COUNT(*) FROM catalog_shares),
    'active_banners', (SELECT COUNT(*) FROM catalog_banners WHERE is_active = TRUE)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test the function
SELECT get_catalog_statistics();
