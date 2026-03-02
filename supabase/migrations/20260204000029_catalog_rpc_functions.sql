-- Additional RPC Functions for Catalog System
-- Execute these after running the main migration

-- ============================================================================
-- 1. Function to increment product views
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE products 
  SET 
    views_count = COALESCE(views_count, 0) + 1,
    last_viewed_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Function to increment banner clicks
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_banner_clicks(banner_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE catalog_banners 
  SET clicks_count = COALESCE(clicks_count, 0) + 1
  WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Function to increment banner views
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_banner_views(banner_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE catalog_banners 
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Function to get popular products (most viewed)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_popular_products(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  model TEXT,
  price NUMERIC,
  image TEXT,
  views_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.brand,
    p.model,
    p.price,
    p.image,
    p.views_count
  FROM products p
  WHERE p.status = 'active'
  ORDER BY p.views_count DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Function to get trending products (most viewed in last 7 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trending_products(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  model TEXT,
  price NUMERIC,
  image TEXT,
  view_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.brand,
    p.model,
    p.price,
    p.image,
    COUNT(pv.id) as view_count
  FROM products p
  LEFT JOIN product_views pv ON p.id = pv.product_id
  WHERE 
    p.status = 'active' AND
    pv.viewed_at >= NOW() - INTERVAL '7 days'
  GROUP BY p.id, p.name, p.brand, p.model, p.price, p.image
  ORDER BY view_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Function to get catalog statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_catalog_statistics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_products', (SELECT COUNT(*) FROM products WHERE status = 'active'),
    'total_categories', (SELECT COUNT(DISTINCT category) FROM products WHERE status = 'active'),
    'total_brands', (SELECT COUNT(DISTINCT brand) FROM products WHERE status = 'active'),
    'total_views', (SELECT SUM(views_count) FROM products WHERE status = 'active'),
    'total_favorites', (SELECT COUNT(*) FROM customer_favorites),
    'total_shares', (SELECT COUNT(*) FROM catalog_shares),
    'active_banners', (SELECT COUNT(*) FROM catalog_banners WHERE is_active = TRUE)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

-- Allow public to call increment functions
GRANT EXECUTE ON FUNCTION increment_product_views(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_banner_clicks(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_banner_views(UUID) TO anon, authenticated;

-- Allow public to call read functions
GRANT EXECUTE ON FUNCTION get_popular_products(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_trending_products(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_catalog_statistics() TO anon, authenticated;
