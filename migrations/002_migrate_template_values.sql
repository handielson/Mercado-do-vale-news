-- Migration de Dados - Versão Simplificada
-- Data: 2026-02-10
-- Apenas migra template_values para colunas

-- Migrar template_values para colunas em models
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

-- Verificação
SELECT 
    'Migration concluída!' as status,
    (SELECT COUNT(*) FROM models) as total_modelos,
    (SELECT COUNT(*) FROM models WHERE processor IS NOT NULL) as modelos_com_processor,
    (SELECT COUNT(*) FROM models WHERE battery_mah IS NOT NULL) as modelos_com_bateria,
    (SELECT COUNT(*) FROM model_variants) as variantes_existentes,
    (SELECT COUNT(*) FROM products) as total_produtos;
