-- ============================================
-- Script: Diagnóstico Completo do Catálogo
-- Data: 2026-02-07
-- Objetivo: Identificar a causa real do AbortError
-- ============================================

-- 1. Verificar se há dados na tabela products
SELECT COUNT(*) as total_products FROM products;

-- 2. Testar query básica de produtos (sem RLS)
SELECT id, name, brand, price_retail, featured, created_at
FROM products
ORDER BY featured DESC, created_at DESC
LIMIT 5;

-- 3. Verificar políticas RLS da tabela products
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'products';

-- 4. Verificar se RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'products';

-- 5. Testar query de company_settings (causa do timeout no ThemeContext)
SELECT * FROM company_settings LIMIT 1;

-- 6. Verificar RLS de company_settings
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'company_settings';
