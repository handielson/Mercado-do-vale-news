-- ============================================================================
-- ADICIONAR TODOS OS CAMPOS GLOBAIS EM TODAS AS CATEGORIAS
-- ============================================================================
-- Este SQL adiciona todos os campos globais em todas as categorias
-- com status "optional" por padrão
-- ============================================================================

DO $$
DECLARE
    v_category RECORD;
    v_field RECORD;
    v_existing_field_ids TEXT[];
    v_new_fields JSONB;
BEGIN
    RAISE NOTICE '🔄 Adicionando campos globais em todas as categorias...';
    
    -- Processar cada categoria
    FOR v_category IN 
        SELECT id, name, config 
        FROM categories
    LOOP
        RAISE NOTICE '📁 Processando categoria: %', v_category.name;
        
        -- Pegar IDs dos campos já existentes nesta categoria
        SELECT ARRAY_AGG(elem->>'field_id')
        INTO v_existing_field_ids
        FROM jsonb_array_elements(COALESCE(v_category.config->'custom_fields', '[]'::jsonb)) elem
        WHERE elem->>'field_id' IS NOT NULL;
        
        -- Iniciar com campos existentes
        v_new_fields := COALESCE(v_category.config->'custom_fields', '[]'::jsonb);
        
        -- Adicionar campos globais que ainda não existem
        FOR v_field IN 
            SELECT id, label
            FROM custom_fields
            WHERE id::text != ALL(COALESCE(v_existing_field_ids, ARRAY[]::TEXT[]))
            ORDER BY display_order, label
        LOOP
            RAISE NOTICE '  ➕ Adicionando campo: %', v_field.label;
            
            v_new_fields := v_new_fields || jsonb_build_array(
                jsonb_build_object(
                    'id', 'custom-' || extract(epoch from now())::bigint || '-' || v_field.id,
                    'field_id', v_field.id,
                    'requirement', 'optional'
                )
            );
        END LOOP;
        
        -- Atualizar categoria
        UPDATE categories
        SET config = jsonb_set(config, '{custom_fields}', v_new_fields)
        WHERE id = v_category.id;
        
        RAISE NOTICE '  ✅ Categoria atualizada com % campos', jsonb_array_length(v_new_fields);
    END LOOP;
    
    RAISE NOTICE '🎉 Todos os campos globais foram adicionados!';
END $$;

-- Verificar resultado
SELECT 
    '=== VERIFICAÇÃO: Campos por Categoria ===' as info;

SELECT 
    c.name as categoria,
    COUNT(*) as total_campos,
    COUNT(*) FILTER (WHERE field->>'requirement' = 'required') as obrigatorios,
    COUNT(*) FILTER (WHERE field->>'requirement' = 'optional') as opcionais,
    COUNT(*) FILTER (WHERE field->>'requirement' = 'hidden') as ocultos
FROM categories c,
     jsonb_array_elements(c.config->'custom_fields') as field
GROUP BY c.name
ORDER BY c.name;

-- ============================================================================
-- INSTRUÇÕES:
-- ============================================================================
-- 1. Execute este SQL
-- 2. Recarregue a página de categorias
-- 3. Todos os campos globais estarão disponíveis em todas as categorias
-- 4. Você pode ajustar o status (Oculto/Opcional/Obrigatório) de cada campo
-- ============================================================================
