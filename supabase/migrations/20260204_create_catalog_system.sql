-- Migration: Add Catalog System
-- Description: Adds all necessary tables and fields for the modern sales catalog

-- ============================================================================
-- 1. Add catalog fields to products table
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  featured BOOLEAN DEFAULT FALSE;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  is_new BOOLEAN DEFAULT FALSE;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  discount_percentage INTEGER DEFAULT 0;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  views_count INTEGER DEFAULT 0;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  last_viewed_at TIMESTAMP;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  seo_title TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  seo_description TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
  seo_keywords TEXT[];

-- ============================================================================
-- 2. Create catalog_banners table
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  link_type TEXT CHECK (link_type IN ('product', 'category', 'external', 'none')),
  link_target TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  clicks_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for active banners
CREATE INDEX IF NOT EXISTS idx_catalog_banners_active 
ON catalog_banners(is_active, display_order)
WHERE is_active = TRUE;

-- ============================================================================
-- 3. Create catalog_shares table (analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_type TEXT CHECK (share_type IN ('whatsapp', 'copy', 'pdf')),
  scope TEXT CHECK (scope IN ('full', 'category', 'product')),
  scope_value TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_id TEXT,
  shared_at TIMESTAMP DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_catalog_shares_analytics 
ON catalog_shares(share_type, scope, shared_at);

-- ============================================================================
-- 4. Create product_images table
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for product lookup
CREATE INDEX IF NOT EXISTS idx_product_images_product 
ON product_images(product_id, display_order);

-- ============================================================================
-- 5. Create customer_favorites table
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- Index for customer lookup
CREATE INDEX IF NOT EXISTS idx_customer_favorites_customer 
ON customer_favorites(customer_id);

-- Index for product lookup
CREATE INDEX IF NOT EXISTS idx_customer_favorites_product 
ON customer_favorites(product_id);

-- ============================================================================
-- 6. Create product_views table
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_id TEXT,
  viewed_at TIMESTAMP DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_product_views_product 
ON product_views(product_id, viewed_at DESC);

-- ============================================================================
-- 7. Create system_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT CHECK (level IN ('error', 'warning', 'info', 'debug')),
  message TEXT NOT NULL,
  stack TEXT,
  endpoint TEXT,
  user_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for log queries
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created 
ON system_logs(level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_created 
ON system_logs(created_at DESC);

-- ============================================================================
-- 8. Create performance_metrics table
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Index for metric aggregations
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_recorded 
ON performance_metrics(metric_type, recorded_at DESC);

-- ============================================================================
-- 9. Create performance indexes on products
-- ============================================================================

-- Index for active products with price
CREATE INDEX IF NOT EXISTS idx_products_active_price 
ON products(status, price_retail);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category 
ON products(category_id);

-- Index for brand filtering
CREATE INDEX IF NOT EXISTS idx_products_brand 
ON products(brand);

-- Full-text search index (Portuguese)
CREATE INDEX IF NOT EXISTS idx_products_search 
ON products USING gin(to_tsvector('portuguese', 
  COALESCE(name, '') || ' ' || 
  COALESCE(brand, '') || ' ' || 
  COALESCE(model, '')
));

-- Index for featured products
CREATE INDEX IF NOT EXISTS idx_products_featured 
ON products(featured, created) 
WHERE featured = TRUE;

-- ============================================================================
-- 10. Create materialized view for catalog
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS catalog_products AS
SELECT 
  id,
  name,
  brand,
  model,
  price_retail as price,
  discount_percentage,
  images,
  stock_quantity as stock,
  category_id as category,
  featured,
  is_new,
  views_count,
  created
FROM products
WHERE status = 'active'
ORDER BY featured DESC, created DESC;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_catalog_products_category 
ON catalog_products(category);

CREATE INDEX IF NOT EXISTS idx_catalog_products_brand 
ON catalog_products(brand);

-- ============================================================================
-- 11. Create function to refresh catalog view
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_catalog_products()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_products;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. Enable Row Level Security (RLS)
-- ============================================================================

-- Catalog banners - public read
ALTER TABLE catalog_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Banners are viewable by everyone" 
ON catalog_banners FOR SELECT 
USING (is_active = TRUE);

CREATE POLICY "Authenticated users can manage banners" 
ON catalog_banners FOR ALL 
USING (auth.role() = 'authenticated');

-- Product images - public read
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product images are viewable by everyone" 
ON product_images FOR SELECT 
USING (TRUE);

CREATE POLICY "Authenticated users can manage product images" 
ON product_images FOR ALL 
USING (auth.role() = 'authenticated');

-- Customer favorites - user can manage their own
ALTER TABLE customer_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites" 
ON customer_favorites FOR SELECT 
USING (auth.uid() = customer_id);

CREATE POLICY "Users can manage their own favorites" 
ON customer_favorites FOR ALL 
USING (auth.uid() = customer_id);

-- Product views - insert only
ALTER TABLE product_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record product views" 
ON product_views FOR INSERT 
WITH CHECK (TRUE);

-- System logs - authenticated users can insert
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view logs" 
ON system_logs FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can insert logs" 
ON system_logs FOR INSERT 
WITH CHECK (TRUE);

-- Performance metrics - authenticated users
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view metrics" 
ON performance_metrics FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can insert metrics" 
ON performance_metrics FOR INSERT 
WITH CHECK (TRUE);

-- Catalog shares - insert only for analytics
ALTER TABLE catalog_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record shares" 
ON catalog_shares FOR INSERT 
WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can view shares" 
ON catalog_shares FOR SELECT 
USING (auth.role() = 'authenticated');
