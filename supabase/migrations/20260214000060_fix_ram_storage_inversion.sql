-- Migration: Fix RAM/Storage Inversion
-- Data: 2026-02-14
-- Descrição: Corrige produtos com RAM e Storage invertidos (ex: 256GB/8GB → 8GB/256GB)
-- Objetivo: Garantir padrão RAM/Storage para correto agrupamento de produtos

-- ============================================
-- 1. Criar backup temporário
-- ============================================

-- Backup de produtos que serão alterados
CREATE TEMP TABLE IF NOT EXISTS products_ram_storage_backup AS
SELECT 
    id,
    name,
    specs,
    updated_at
FROM products
WHERE 
    specs IS NOT NULL
    AND specs->>'ram' IS NOT NULL
    AND specs->>'storage' IS NOT NULL
    AND CAST(REGEXP_REPLACE(specs->>'ram', '[^0-9]', '', 'g') AS INTEGER) >
        CAST(REGEXP_REPLACE(specs->>'storage', '[^0-9]', '', 'g') AS INTEGER);

-- Log de quantos produtos serão afetados
DO $$
DECLARE
    affected_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO affected_count FROM products_ram_storage_backup;
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Produtos com RAM/Storage invertidos: %', affected_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- 2. Corrigir specs (trocar RAM e Storage)
-- ============================================

UPDATE products
SET specs = jsonb_set(
    jsonb_set(
        specs,
        '{ram}',
        to_jsonb(specs->>'storage')
    ),
    '{storage}',
    to_jsonb(specs->>'ram')
)
WHERE 
    specs IS NOT NULL
    AND specs->>'ram' IS NOT NULL
    AND specs->>'storage' IS NOT NULL
    AND CAST(REGEXP_REPLACE(specs->>'ram', '[^0-9]', '', 'g') AS INTEGER) >
        CAST(REGEXP_REPLACE(specs->>'storage', '[^0-9]', '', 'g') AS INTEGER);

-- ============================================
-- 3. Atualizar nomes de produtos
-- ============================================

-- Remover padrão RAM/Storage do final dos nomes (ex: ", 256GB/8GB")
-- Isso evita duplicação quando a aplicação adiciona as specs na exibição
UPDATE products
SET name = REGEXP_REPLACE(
    name,
    ',?\s*\d+\s*GB\s*/\s*\d+\s*GB\s*$',  -- Padrão: ", 256GB/8GB" ou "256GB/8GB" no final
    '',
    'gi'  -- Case insensitive, global
)
WHERE 
    name ~* '\d+\s*GB\s*/\s*\d+\s*GB'  -- Contém padrão GB/GB
    AND id IN (SELECT id FROM products_ram_storage_backup);  -- Apenas produtos afetados

-- Log de produtos com nomes atualizados
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count 
    FROM products_ram_storage_backup 
    WHERE name ~* '\d+\s*GB\s*/\s*\d+\s*GB';
    
    RAISE NOTICE 'Nomes de produtos limpos: %', updated_count;
END $$;

-- ============================================
-- 4. Criar função de normalização
-- ============================================

CREATE OR REPLACE FUNCTION normalize_product_ram_storage()
RETURNS TRIGGER AS $$
DECLARE
    ram_value TEXT;
    storage_value TEXT;
    ram_gb INTEGER;
    storage_gb INTEGER;
BEGIN
    -- Verificar se specs existe e tem ram/storage
    IF NEW.specs IS NULL OR 
       NEW.specs->>'ram' IS NULL OR 
       NEW.specs->>'storage' IS NULL THEN
        RETURN NEW;
    END IF;

    ram_value := NEW.specs->>'ram';
    storage_value := NEW.specs->>'storage';

    -- Extrair valores numéricos
    BEGIN
        ram_gb := CAST(REGEXP_REPLACE(ram_value, '[^0-9]', '', 'g') AS INTEGER);
        storage_gb := CAST(REGEXP_REPLACE(storage_value, '[^0-9]', '', 'g') AS INTEGER);
    EXCEPTION WHEN OTHERS THEN
        -- Se não conseguir extrair números, retornar sem modificar
        RETURN NEW;
    END;

    -- Se RAM > Storage, estão invertidos - corrigir
    IF ram_gb > 0 AND storage_gb > 0 AND ram_gb > storage_gb THEN
        -- Trocar valores
        NEW.specs := jsonb_set(NEW.specs, '{ram}', to_jsonb(storage_value));
        NEW.specs := jsonb_set(NEW.specs, '{storage}', to_jsonb(ram_value));
        
        RAISE NOTICE 'RAM/Storage invertidos detectados e corrigidos: % ↔ %', ram_value, storage_value;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Criar trigger
-- ============================================

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS ensure_ram_storage_order ON products;

-- Criar novo trigger
CREATE TRIGGER ensure_ram_storage_order
    BEFORE INSERT OR UPDATE OF specs ON products
    FOR EACH ROW
    EXECUTE FUNCTION normalize_product_ram_storage();

-- ============================================
-- 6. Verificação final
-- ============================================

DO $$
DECLARE
    remaining_inverted INTEGER;
    total_corrected INTEGER;
BEGIN
    -- Contar produtos ainda invertidos
    SELECT COUNT(*) INTO remaining_inverted
    FROM products
    WHERE 
        specs IS NOT NULL
        AND specs->>'ram' IS NOT NULL
        AND specs->>'storage' IS NOT NULL
        AND CAST(REGEXP_REPLACE(specs->>'ram', '[^0-9]', '', 'g') AS INTEGER) >
            CAST(REGEXP_REPLACE(specs->>'storage', '[^0-9]', '', 'g') AS INTEGER);

    -- Contar produtos corrigidos
    SELECT COUNT(*) INTO total_corrected FROM products_ram_storage_backup;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Produtos corrigidos: %', total_corrected;
    RAISE NOTICE 'Produtos ainda invertidos: %', remaining_inverted;
    RAISE NOTICE '============================================';
    
    IF remaining_inverted > 0 THEN
        RAISE WARNING 'Ainda existem % produtos com RAM/Storage invertidos!', remaining_inverted;
    ELSE
        RAISE NOTICE '✅ Todos os produtos foram normalizados com sucesso!';
    END IF;
END $$;

-- ============================================
-- ROLLBACK (Se necessário)
-- ============================================
-- Para reverter esta migração, execute:
--
-- UPDATE products p
-- SET 
--     specs = b.specs,
--     name = b.name
-- FROM products_ram_storage_backup b
-- WHERE p.id = b.id;
--
-- DROP TRIGGER IF EXISTS ensure_ram_storage_order ON products;
-- DROP FUNCTION IF EXISTS normalize_product_ram_storage();
-- ============================================
