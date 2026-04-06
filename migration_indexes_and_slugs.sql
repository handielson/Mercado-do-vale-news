-- ═══════════════════════════════════════════════════════════
-- 📊 Índices de Performance — Mercado do Vale VPS MySQL
-- Execute no MySQL da VPS para acelerar a query de catálogo
-- ═══════════════════════════════════════════════════════════

-- 1. Índice composto para a query principal do catálogo:
--    WHERE status = 'active' ORDER BY name
CREATE INDEX IF NOT EXISTS idx_products_status_name 
  ON products (status, name);

-- 2. Índice para busca por categoria:
--    WHERE status = 'active' AND category_id = ?
CREATE INDEX IF NOT EXISTS idx_products_status_cat 
  ON products (status, category_id);

-- 3. Índice para busca por SKU (busca do admin, PDV):
CREATE INDEX IF NOT EXISTS idx_products_sku 
  ON products (sku);

-- 4. Índice para busca por slug (PublicProductPage):
CREATE INDEX IF NOT EXISTS idx_products_slug 
  ON products (slug);

-- 5. Auto-preenche slug para produtos que não têm (resolve URL com ID)
--    Formato: "Caneta Stylus..." → "caneta-stylus..."
UPDATE products
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9 -]', ' '),
      ' {2,}', ' '
    ),
    ' ', '-'
  )
)
WHERE (slug IS NULL OR slug = '') AND name IS NOT NULL AND name != '';

-- ══════════════════════════════════════════════════════════
-- Verificação final
-- ══════════════════════════════════════════════════════════
SELECT 
  TABLE_NAME, INDEX_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
ORDER BY INDEX_NAME;
