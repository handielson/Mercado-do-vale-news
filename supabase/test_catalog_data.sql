-- Test Data for Catalog System
-- Execute this after running migrations to populate test data

-- ============================================================================
-- 1. Insert sample banners
-- ============================================================================

INSERT INTO catalog_banners (title, image_url, link_type, link_target, display_order, is_active)
VALUES 
  (
    'Promoção Xiaomi Redmi Note 15',
    'https://via.placeholder.com/1200x400/3B82F6/FFFFFF?text=Xiaomi+Redmi+Note+15',
    'category',
    'smartphones',
    0,
    TRUE
  ),
  (
    'Novidades em Acessórios',
    'https://via.placeholder.com/1200x400/10B981/FFFFFF?text=Novos+Acessorios',
    'category',
    'acessorios',
    1,
    TRUE
  ),
  (
    'Ofertas Imperdíveis',
    'https://via.placeholder.com/1200x400/F59E0B/FFFFFF?text=Ofertas+Imperdiveis',
    'none',
    NULL,
    2,
    TRUE
  );

-- ============================================================================
-- 2. Update some products as featured
-- ============================================================================

-- Marcar os 5 produtos mais recentes como destaque
UPDATE products
SET featured = TRUE
WHERE id IN (
  SELECT id 
  FROM products 
  ORDER BY created_at DESC 
  LIMIT 5
);

-- ============================================================================
-- 3. Update some products as new
-- ============================================================================

-- Marcar os 10 produtos mais recentes como novos
UPDATE products
SET is_new = TRUE
WHERE id IN (
  SELECT id 
  FROM products 
  ORDER BY created_at DESC 
  LIMIT 10
);

-- ============================================================================
-- 4. Add discount to some products
-- ============================================================================

-- Adicionar desconto de 10% a alguns produtos
UPDATE products
SET discount_percentage = 10
WHERE id IN (
  SELECT id 
  FROM products 
  ORDER BY RANDOM()
  LIMIT 5
);

-- Adicionar desconto de 20% a alguns produtos
UPDATE products
SET discount_percentage = 20
WHERE id IN (
  SELECT id 
  FROM products 
  WHERE discount_percentage = 0
  ORDER BY RANDOM()
  LIMIT 3
);

-- ============================================================================
-- 5. Verify test data
-- ============================================================================

-- Check banners
SELECT 
  title,
  link_type,
  is_active,
  display_order
FROM catalog_banners
ORDER BY display_order;

-- Check featured products
SELECT 
  name,
  brand,
  price_retail,
  featured,
  is_new,
  discount_percentage
FROM products
WHERE featured = TRUE OR is_new = TRUE OR discount_percentage > 0
ORDER BY featured DESC, is_new DESC, discount_percentage DESC;

-- Check catalog statistics
SELECT get_catalog_statistics();
