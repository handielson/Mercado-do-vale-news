-- ============================================================================
-- Script de Migração de Dados - Nova Arquitetura de Produtos
-- Descrição: Migra dados existentes para a nova estrutura
-- Data: 2026-02-10
-- ============================================================================

-- IMPORTANTE: Execute este script APÓS executar 001_new_product_architecture.sql

-- ============================================================================
-- ETAPA 1: MIGRAR TEMPLATE_VALUES PARA COLUNAS EM MODELS
-- ============================================================================

DO $$
DECLARE
    model_record RECORD;
    template_data JSONB;
    migrated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Iniciando migração de template_values para colunas...';
    
    FOR model_record IN 
        SELECT id, template_values 
        FROM models 
        WHERE template_values IS NOT NULL 
        AND template_values != '{}'::jsonb
    LOOP
        template_data := model_record.template_values;
        
        -- Atualizar colunas com dados do template_values
        UPDATE models SET
            processor = COALESCE(template_data->>'processor', processor),
            chipset = COALESCE(template_data->>'chipset', chipset),
            battery_mah = COALESCE((template_data->>'battery_mah')::INTEGER, battery_mah),
            display = COALESCE((template_data->>'display')::DECIMAL(3,2), display),
            main_camera_mpx = COALESCE(template_data->>'main_camera_mpx', main_camera_mpx),
            selfie_camera_mpx = COALESCE(template_data->>'selfie_camera_mpx', selfie_camera_mpx),
            nfc = COALESCE(template_data->>'nfc', nfc),
            network = COALESCE(template_data->>'network', network),
            resistencia = COALESCE(template_data->>'resistencia', resistencia),
            antutu = COALESCE(template_data->>'antutu', antutu)
        WHERE id = model_record.id;
        
        migrated_count := migrated_count + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Migrados %s modelos de template_values para colunas', migrated_count;
END $$;

-- ============================================================================
-- ETAPA 2: CRIAR VARIANTES PARA PRODUTOS EXISTENTES
-- ============================================================================

DO $$
DECLARE
    product_record RECORD;
    variant_record RECORD;
    created_variants INTEGER := 0;
    updated_products INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Criando variantes para produtos existentes...';
    
    FOR product_record IN 
        SELECT 
            p.id as product_id,
            p.model_id,
            p.color_id,
            COALESCE(p.specs->>'version', 'Global') as version_name
        FROM products p
        WHERE p.model_id IS NOT NULL 
        AND p.color_id IS NOT NULL
        AND p.variant_id IS NULL
    LOOP
        -- Buscar ou criar version_id
        DECLARE
            version_uuid UUID;
        BEGIN
            SELECT id INTO version_uuid 
            FROM versions 
            WHERE name = product_record.version_name 
            LIMIT 1;
            
            -- Se não encontrou, usar primeira versão disponível
            IF version_uuid IS NULL THEN
                SELECT id INTO version_uuid 
                FROM versions 
                LIMIT 1;
            END IF;
            
            -- Buscar ou criar variante
            SELECT id INTO variant_record 
            FROM model_variants 
            WHERE model_id = product_record.model_id 
            AND version_id = version_uuid 
            AND color_id = product_record.color_id;
            
            -- Se não existe, criar
            IF variant_record IS NULL THEN
                INSERT INTO model_variants (model_id, version_id, color_id)
                VALUES (product_record.model_id, version_uuid, product_record.color_id)
                RETURNING id INTO variant_record;
                
                created_variants := created_variants + 1;
            END IF;
            
            -- Associar produto à variante
            UPDATE products 
            SET variant_id = variant_record 
            WHERE id = product_record.product_id;
            
            updated_products := updated_products + 1;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ Criadas %s variantes', created_variants;
    RAISE NOTICE '✅ Atualizados %s produtos com variant_id', updated_products;
END $$;

-- ============================================================================
-- ETAPA 3: VALIDAÇÃO DE INTEGRIDADE
-- ============================================================================

DO $$
DECLARE
    models_with_specs INTEGER;
    products_with_variants INTEGER;
    total_models INTEGER;
    total_products INTEGER;
BEGIN
    RAISE NOTICE '🔍 Validando integridade dos dados...';
    
    -- Contar modelos com especificações
    SELECT COUNT(*) INTO models_with_specs 
    FROM models 
    WHERE processor IS NOT NULL 
    OR chipset IS NOT NULL 
    OR battery_mah IS NOT NULL;
    
    SELECT COUNT(*) INTO total_models FROM models;
    
    -- Contar produtos com variantes
    SELECT COUNT(*) INTO products_with_variants 
    FROM products 
    WHERE variant_id IS NOT NULL;
    
    SELECT COUNT(*) INTO total_products FROM products;
    
    RAISE NOTICE '📊 Estatísticas:';
    RAISE NOTICE '   Modelos com especificações: %s/%s (%.1f%%)', 
        models_with_specs, 
        total_models, 
        (models_with_specs::FLOAT / NULLIF(total_models, 0) * 100);
    
    RAISE NOTICE '   Produtos com variantes: %s/%s (%.1f%%)', 
        products_with_variants, 
        total_products, 
        (products_with_variants::FLOAT / NULLIF(total_products, 0) * 100);
    
    -- Verificar produtos sem variante
    IF products_with_variants < total_products THEN
        RAISE WARNING '⚠️  Existem %s produtos sem variante associada', 
            (total_products - products_with_variants);
        RAISE NOTICE '   Execute: SELECT id, name, model_id, color_id FROM products WHERE variant_id IS NULL;';
    END IF;
END $$;

-- ============================================================================
-- ETAPA 4: CRIAR ÍNDICES ADICIONAIS PARA QUERIES COMUNS
-- ============================================================================

-- Índice composto para busca de produtos por modelo + variante
CREATE INDEX IF NOT EXISTS idx_products_model_variant 
ON products(model_id, variant_id) 
WHERE status = 'active';

-- Índice para busca de variantes com imagens
CREATE INDEX IF NOT EXISTS idx_variants_with_images 
ON model_variants(id) 
WHERE EXISTS (
    SELECT 1 FROM model_variant_images 
    WHERE variant_id = model_variants.id
);

RAISE NOTICE '✅ Índices adicionais criados';

-- ============================================================================
-- ETAPA 5: RELATÓRIO FINAL
-- ============================================================================

DO $$
DECLARE
    total_eans INTEGER;
    total_variants INTEGER;
    total_images INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_eans FROM model_eans;
    SELECT COUNT(*) INTO total_variants FROM model_variants;
    SELECT COUNT(*) INTO total_images FROM model_variant_images;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Resumo:';
    RAISE NOTICE '   - EANs cadastrados: %s', total_eans;
    RAISE NOTICE '   - Variantes criadas: %s', total_variants;
    RAISE NOTICE '   - Imagens cadastradas: %s', total_images;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Próximos Passos:';
    RAISE NOTICE '   1. Verificar produtos sem variante (se houver)';
    RAISE NOTICE '   2. Cadastrar EANs para os modelos';
    RAISE NOTICE '   3. Fazer upload de imagens das variantes';
    RAISE NOTICE '   4. Atualizar interfaces de administração';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;
