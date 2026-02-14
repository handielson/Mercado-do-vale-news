-- ============================================
-- Verificação de Produtos com RAM/Storage Invertidos
-- Execute ANTES da migração para ver o estado atual
-- ============================================

-- 1. Contar produtos com inversão
SELECT COUNT(*) as total_invertidos
FROM products
WHERE 
    specs IS NOT NULL
    AND specs->>'ram' IS NOT NULL
    AND specs->>'storage' IS NOT NULL
    AND CAST(REGEXP_REPLACE(specs->>'ram', '[^0-9]', '', 'g') AS INTEGER) >
        CAST(REGEXP_REPLACE(specs->>'storage', '[^0-9]', '', 'g') AS INTEGER);

-- 2. Listar produtos invertidos (detalhado)
SELECT 
    id,
    name,
    specs->>'ram' as ram_atual,
    specs->>'storage' as storage_atual,
    specs->>'color' as cor,
    -- Como ficará após correção:
    specs->>'storage' as ram_corrigido,
    specs->>'ram' as storage_corrigido
FROM products
WHERE 
    specs IS NOT NULL
    AND specs->>'ram' IS NOT NULL
    AND specs->>'storage' IS NOT NULL
    AND CAST(REGEXP_REPLACE(specs->>'ram', '[^0-9]', '', 'g') AS INTEGER) >
        CAST(REGEXP_REPLACE(specs->>'storage', '[^0-9]', '', 'g') AS INTEGER)
ORDER BY name, specs->>'ram', specs->>'storage';

-- 3. Agrupar por modelo e variante (antes da correção)
SELECT 
    COALESCE(model, 'Sem modelo') as modelo,
    specs->>'ram' as ram,
    specs->>'storage' as storage,
    COUNT(*) as quantidade_produtos,
    STRING_AGG(DISTINCT specs->>'color', ', ') as cores
FROM products
WHERE 
    specs IS NOT NULL
    AND specs->>'ram' IS NOT NULL
    AND specs->>'storage' IS NOT NULL
GROUP BY model, specs->>'ram', specs->>'storage'
HAVING COUNT(*) > 1  -- Apenas variantes com múltiplas cores
ORDER BY modelo, ram, storage;

-- ============================================
-- Verificação APÓS a migração
-- Execute para confirmar que a correção funcionou
-- ============================================

-- 4. Verificar se ainda há produtos invertidos (deve retornar 0)
SELECT COUNT(*) as produtos_ainda_invertidos
FROM products
WHERE 
    specs IS NOT NULL
    AND specs->>'ram' IS NOT NULL
    AND specs->>'storage' IS NOT NULL
    AND CAST(REGEXP_REPLACE(specs->>'ram', '[^0-9]', '', 'g') AS INTEGER) >
        CAST(REGEXP_REPLACE(specs->>'storage', '[^0-9]', '', 'g') AS INTEGER);

-- 5. Listar produtos corrigidos (comparar com backup)
SELECT 
    p.id,
    p.name as nome_atual,
    p.specs->>'ram' as ram_atual,
    p.specs->>'storage' as storage_atual,
    b.specs->>'ram' as ram_antes,
    b.specs->>'storage' as storage_antes
FROM products p
INNER JOIN products_ram_storage_backup b ON p.id = b.id
ORDER BY p.name;

-- 6. Verificar agrupamento correto (após correção)
SELECT 
    COALESCE(model, 'Sem modelo') as modelo,
    specs->>'ram' as ram,
    specs->>'storage' as storage,
    COUNT(*) as quantidade_produtos,
    STRING_AGG(DISTINCT specs->>'color', ', ') as cores_disponiveis
FROM products
WHERE 
    specs IS NOT NULL
    AND specs->>'ram' IS NOT NULL
    AND specs->>'storage' IS NOT NULL
    AND status = 'active'
GROUP BY model, specs->>'ram', specs->>'storage'
ORDER BY modelo, 
    CAST(REGEXP_REPLACE(specs->>'ram', '[^0-9]', '', 'g') AS INTEGER),
    CAST(REGEXP_REPLACE(specs->>'storage', '[^0-9]', '', 'g') AS INTEGER);

-- 7. Testar trigger (inserir produto com inversão)
-- ATENÇÃO: Este é apenas um teste, não execute em produção sem backup!
/*
INSERT INTO products (name, specs, status, price_retail, stock_quantity)
VALUES (
    'Teste Trigger',
    '{"ram": "256GB", "storage": "8GB", "color": "Preto"}'::jsonb,
    'active',
    100000,
    1
)
RETURNING 
    id,
    name,
    specs->>'ram' as ram,
    specs->>'storage' as storage;
-- Deve retornar: ram = "8GB", storage = "256GB" (corrigido automaticamente)
*/
