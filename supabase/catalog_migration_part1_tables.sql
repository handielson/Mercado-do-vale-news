-- Simplified Catalog Migration - Part 1: Tables Only
-- Execute this in Supabase SQL Editor

-- ============================================================================
-- 1. Add catalog fields to products table
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP;

-- ============================================================================
-- 2. Create catalog_shares table
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

-- ============================================================================
-- 3. Create product_images table
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 4. Create customer_favorites table
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- ============================================================================
-- 5. Create product_views table
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  session_id TEXT,
  viewed_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 6. Create system_logs table
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

-- ============================================================================
-- 7. Create performance_metrics table
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('catalog_banners', 'catalog_shares', 'product_images', 'customer_favorites', 'product_views', 'system_logs', 'performance_metrics')
ORDER BY table_name;
