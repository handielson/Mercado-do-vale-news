-- ============================================
-- Script: Criar Índices para Performance do Catálogo
-- Data: 2026-02-07
-- Objetivo: Otimizar queries do catálogo que usam ORDER BY featured DESC, created_at DESC
-- ============================================

-- 1. Remover índices antigos se existirem (para evitar duplicação)
DROP INDEX IF EXISTS idx_products_catalog_performance;
DROP INDEX IF EXISTS idx_products_featured_created;

-- 2. Criar índice composto para a query do catálogo
-- Este índice otimiza: ORDER BY featured DESC, created_at DESC
CREATE INDEX idx_products_catalog_performance 
ON products (featured DESC, created_at DESC);

-- 3. Verificar se o índice foi criado
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'products'
ORDER BY indexname;

-- 4. Testar a query com EXPLAIN ANALYZE para verificar se está usando o índice
EXPLAIN ANALYZE
SELECT *
FROM products
ORDER BY featured DESC, created_at DESC
LIMIT 20;
