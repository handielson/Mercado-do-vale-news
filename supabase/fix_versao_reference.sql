-- ============================================================================
-- CORRIGIR: Vincular campo "Versão" da categoria ao campo global
-- ============================================================================
-- Este SQL vai substituir o campo inline pelo formato de referência correto
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID;
    v_field_id UUID;
    v_category_id UUID;
BEGIN
    -- Pegar company_id
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    
    -- Pegar o ID do campo global "Versão"
    SELECT id INTO v_field_id 
    FROM custom_fields 
    WHERE company_id = v_company_id 
      AND key = 'versao';
    
    IF v_field_id IS NULL THEN
        RAISE EXCEPTION '❌ Campo global "Versão" não encontrado! Execute setup_table_relation_fields.sql primeiro.';
    END IF;
    
    -- Pegar ID da categoria Celulares
    SELECT id INTO v_category_id 
    FROM categories 
    WHERE name = 'Celulares';
    
    IF v_category_id IS NULL THEN
        RAISE EXCEPTION '❌ Categoria "Celulares" não encontrada!';
    END IF;
    
    -- Atualizar o campo na categoria para usar referência
    UPDATE categories
    SET config = jsonb_set(
        config,
        '{custom_fields}',
        (
            SELECT jsonb_agg(
                CASE 
                    -- Se for o campo versão inline, substituir por referência
                    WHEN elem->>'key' = 'versao' THEN
                        jsonb_build_object(
                            'id', elem->>'id',
                            'field_id', v_field_id,
                            'requirement', COALESCE(elem->>'requirement', 'optional')
                        )
                    -- Manter outros campos como estão
                    ELSE elem
                END
            )
            FROM jsonb_array_elements(config->'custom_fields') elem
        )
    )
    WHERE id = v_category_id
      AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(config->'custom_fields') elem
          WHERE elem->>'key' = 'versao'
      );
    
    RAISE NOTICE '✅ Campo "Versão" vinculado ao campo global com ID: %', v_field_id;
END $$;

-- Verificar o resultado
SELECT 
    '=== VERIFICAÇÃO: Campo Global ===' as info;

SELECT 
    id,
    key,
    label,
    field_type,
    jsonb_pretty(table_config) as table_config
FROM custom_fields
WHERE key = 'versao';

SELECT 
    '=== VERIFICAÇÃO: Campo na Categoria ===' as info;

SELECT 
    c.name as category_name,
    field->>'id' as local_id,
    field->>'field_id' as field_id_reference,
    field->>'requirement' as requirement
FROM categories c,
     jsonb_array_elements(c.config->'custom_fields') as field
WHERE c.name = 'Celulares'
  AND (field->>'key' = 'versao' OR field->>'field_id' IN (
      SELECT id::text FROM custom_fields WHERE key = 'versao'
  ));

-- ============================================================================
-- INSTRUÇÕES:
-- ============================================================================
-- 1. Execute este SQL
-- 2. Recarregue a página do navegador (Ctrl+F5)
-- 3. Teste criando um novo produto
-- 4. O campo "Versão" deve aparecer como dropdown com opções da tabela versions
-- ============================================================================
