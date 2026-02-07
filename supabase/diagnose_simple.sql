-- =====================================================
-- DIAGNÓSTICO SIMPLIFICADO - EXECUTE PASSO A PASSO
-- =====================================================
-- Execute cada query separadamente e compartilhe os resultados
-- =====================================================

-- PASSO 1: Verificar se existem dados em company_settings
SELECT * FROM company_settings LIMIT 1;

-- PASSO 2: Contar produtos
SELECT COUNT(*) as total FROM products;

-- PASSO 3: Verificar primeiros produtos (query simples)
SELECT id, name, brand, status, created_at 
FROM products 
LIMIT 5;

-- PASSO 4: Testar query com ORDER BY (mesma do catálogo)
SELECT id, name, brand, price_retail, featured, created_at
FROM products
ORDER BY featured DESC, created_at DESC
LIMIT 12;

-- PASSO 5: Verificar índices em products
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'products'
AND indexname LIKE '%featured%' OR indexname LIKE '%created%';
