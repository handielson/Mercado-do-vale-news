-- ============================================================================
-- REMOVER DUPLICATAS: Campos duplicados nas categorias
-- ============================================================================
-- Remove campos duplicados mantendo apenas uma referência por field_id
-- ============================================================================

DO $$
DECLARE
    v_category RECORD;
    v_unique_fields JSONB;
BEGIN
    RAISE NOTICE '🔄 Removendo duplicatas...';
    
    -- Processar cada categoria
    FOR v_category IN 
        SELECT id, name, config 
        FROM categories 
        WHERE config->'custom_fields' IS NOT NULL
    LOOP
        RAISE NOTICE '📁 Processando categoria: %', v_category.name;
        
        -- Remover duplicatas mantendo apenas a primeira ocorrência de cada field_id
        WITH unique_fields AS (
            SELECT DISTINCT ON (elem->>'field_id') elem as field
            FROM jsonb_array_elements(v_category.config->'custom_fields') elem
            WHERE elem->>'field_id' IS NOT NULL
            ORDER BY elem->>'field_id', elem->>'id'
        )
        SELECT jsonb_agg(field) INTO v_unique_fields
        FROM unique_fields;
        
        -- Se não houver campos, usar array vazio
        v_unique_fields := COALESCE(v_unique_fields, '[]'::jsonb);
        
        -- Atualizar categoria
        UPDATE categories
        SET config = jsonb_set(config, '{custom_fields}', v_unique_fields)
        WHERE id = v_category.id;
        
        RAISE NOTICE '  ✅ Removidas duplicatas. Total de campos: %', jsonb_array_length(v_unique_fields);
    END LOOP;
    
    RAISE NOTICE '🎉 Duplicatas removidas!';
END $$;

-- Verificar resultado
SELECT 
    '=== VERIFICAÇÃO: Campos após remoção de duplicatas ===' as info;

SELECT 
    c.name as categoria,
    cf.label as campo,
    field->>'requirement' as status
FROM categories c,
     jsonb_array_elements(c.config->'custom_fields') as field
LEFT JOIN custom_fields cf ON cf.id::text = field->>'field_id'
ORDER BY c.name, cf.label;
