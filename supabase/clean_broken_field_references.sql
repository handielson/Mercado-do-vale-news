-- Limpar campos com referências quebradas (VERSÃO SEGURA)
-- Este SQL remove apenas os campos quebrados, mantendo o resto do config intacto

DO $$
DECLARE
    v_category RECORD;
    v_cleaned_fields JSONB;
BEGIN
    FOR v_category IN 
        SELECT id, name, config 
        FROM categories
        WHERE config->'custom_fields' IS NOT NULL
    LOOP
        -- Filtrar apenas campos válidos
        SELECT COALESCE(jsonb_agg(field), '[]'::jsonb)
        INTO v_cleaned_fields
        FROM jsonb_array_elements(v_category.config->'custom_fields') as field
        WHERE 
            -- Manter campos sem field_id (inline)
            field->>'field_id' IS NULL
            OR
            -- Manter apenas campos cujo field_id existe
            EXISTS (
                SELECT 1 FROM custom_fields cf 
                WHERE cf.id::text = field->>'field_id'
            );
        
        -- Atualizar apenas o custom_fields, mantendo o resto do config
        UPDATE categories
        SET config = jsonb_set(config, '{custom_fields}', v_cleaned_fields)
        WHERE id = v_category.id;
        
        RAISE NOTICE 'Categoria "%": % campos mantidos', v_category.name, jsonb_array_length(v_cleaned_fields);
    END LOOP;
END $$;

-- Verificar resultado
SELECT 
    c.name as categoria,
    jsonb_array_length(c.config->'custom_fields') as total_campos,
    c.config->'custom_fields' as campos
FROM categories c
WHERE c.config->'custom_fields' IS NOT NULL
ORDER BY c.name;
