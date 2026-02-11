-- Migration de Dados - Nova Arquitetura
-- Data: 2026-02-10

-- ETAPA 1: Migrar template_values para colunas
DO $$
DECLARE
    model_record RECORD;
    template_data JSONB;
    migrated_count INTEGER := 0;
BEGIN
    FOR model_record IN 
        SELECT id, template_values 
        FROM models 
        WHERE template_values IS NOT NULL 
        AND template_values != '{}'::jsonb
    LOOP
        template_data := model_record.template_values;
        
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
END $$;

-- ETAPA 2: Criar variantes para produtos existentes
DO $$
DECLARE
    product_record RECORD;
    variant_record UUID;
    version_uuid UUID;
    created_variants INTEGER := 0;
    updated_products INTEGER := 0;
BEGIN
    FOR product_record IN 
        SELECT 
            p.id as product_id,
            p.model_id,
            p.color_id,
            p.company_id,
            COALESCE(p.specs->>'version', 'Global') as version_name
        FROM products p
        WHERE p.model_id IS NOT NULL 
        AND p.color_id IS NOT NULL
        AND p.variant_id IS NULL
    LOOP
        -- Buscar version_id
        SELECT id INTO version_uuid 
        FROM versions 
        WHERE name = product_record.version_name 
        AND company_id = product_record.company_id
        LIMIT 1;
        
        -- Se não encontrou, usar primeira versão disponível
        IF version_uuid IS NULL THEN
            SELECT id INTO version_uuid 
            FROM versions 
            WHERE company_id = product_record.company_id
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
    END LOOP;
END $$;

-- ETAPA 3: Criar índices adicionais
CREATE INDEX IF NOT EXISTS idx_products_model_variant 
ON products(model_id, variant_id) 
WHERE status = 'active';

-- Verificação final
SELECT 
    'Migration concluída!' as status,
    (SELECT COUNT(*) FROM models WHERE processor IS NOT NULL) as modelos_com_specs,
    (SELECT COUNT(*) FROM model_variants) as variantes_criadas,
    (SELECT COUNT(*) FROM products WHERE variant_id IS NOT NULL) as produtos_com_variante,
    (SELECT COUNT(*) FROM products WHERE variant_id IS NULL) as produtos_sem_variante;
