-- =====================================================
-- DIAGNÓSTICO: TIMEOUT EM QUERIES DO CATÁLOGO
-- =====================================================
-- Problema: ThemeContext e Catalog queries timeout após 5 segundos
-- Objetivo: Verificar dados, índices e performance
-- Data: 2026-02-07
-- =====================================================

-- 1. Verificar se existem dados na tabela company_settings
SELECT COUNT(*) as total_settings
FROM company_settings;

-- 1b. Ver dados da company_settings
SELECT * FROM company_settings LIMIT 1;

-- 2. Verificar se existem produtos
SELECT COUNT(*) as total_products
FROM products;

-- 3. Verificar produtos por status
SELECT status, COUNT(*) as count
FROM products
GROUP BY status
ORDER BY count DESC;

-- 4. Verificar índices na tabela products
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'products'
ORDER BY indexname;

-- 5. Verificar índices na tabela company_settings
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'company_settings'
ORDER BY indexname;

-- 6. Testar performance de query simples de products (sem filtros)
EXPLAIN ANALYZE
SELECT id, name, brand, price_retail, stock_quantity
FROM products
LIMIT 20;

-- 7. Verificar se RLS está habilitado nas tabelas
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('products', 'company_settings');

-- 8. Verificar tamanho das tabelas
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE tablename IN ('products', 'company_settings')
ORDER BY size_bytes DESC;

-- 9. Verificar se há queries lentas (se disponível)
-- SELECT query, calls, mean_exec_time, max_exec_time
-- FROM pg_stat_statements
-- WHERE query LIKE '%products%' OR query LIKE '%company_settings%'
-- ORDER BY mean_exec_time DESC
-- LIMIT 10;

-- 10. Testar query exata do catalogService
EXPLAIN ANALYZE
SELECT *
FROM products
ORDER BY featured DESC, created_at DESC
LIMIT 12;
