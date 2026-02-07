-- =====================================================
-- FIX: ADICIONAR ÍNDICES PARA PERFORMANCE DO CATÁLOGO
-- =====================================================
-- Problema: Queries timeout porque faltam índices nas colunas de ordenação
-- Solução: Criar índices compostos para featured + created_at
-- Data: 2026-02-07
-- =====================================================

-- 1. Criar índice composto para a query principal do catálogo
-- Este índice otimiza: ORDER BY featured DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_products_featured_created 
ON products(featured DESC, created_at DESC);

-- 2. Criar índice individual para created_at (usado em outras queries)
CREATE INDEX IF NOT EXISTS idx_products_created_at 
ON products(created_at DESC);

-- 3. Criar índice para featured (usado em filtros)
CREATE INDEX IF NOT EXISTS idx_products_featured 
ON products(featured) 
WHERE featured = true;  -- Índice parcial, mais eficiente

-- 4. Verificar índices criados
SELECT 
    indexname, 
    indexdef
FROM pg_indexes
WHERE tablename = 'products'
AND (indexname LIKE '%featured%' OR indexname LIKE '%created%')
ORDER BY indexname;

-- 5. Testar performance após criação dos índices
EXPLAIN ANALYZE
SELECT *
FROM products
ORDER BY featured DESC, created_at DESC
LIMIT 12;

COMMENT ON INDEX idx_products_featured_created IS 
  'Índice composto para otimizar a query principal do catálogo. Criado em 2026-02-07 para resolver timeout.';

COMMENT ON INDEX idx_products_created_at IS 
  'Índice para ordenação por data de criação. Criado em 2026-02-07.';

COMMENT ON INDEX idx_products_featured IS 
  'Índice parcial para produtos em destaque. Criado em 2026-02-07.';
