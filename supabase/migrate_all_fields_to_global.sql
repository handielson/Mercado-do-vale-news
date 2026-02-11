-- ============================================================================
-- MIGRAÇÃO: Transformar Campos Inline em Campos Globais
-- ============================================================================
-- Este SQL migra todos os campos personalizados inline para a tabela custom_fields
-- e atualiza as categorias para usar apenas referências
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID;
    v_category RECORD;
    v_field RECORD;
    v_field_id UUID;
    v_new_fields JSONB := '[]'::jsonb;
BEGIN
    -- Pegar company_id
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION '❌ Nenhuma empresa encontrada!';
    END IF;
    
    RAISE NOTICE '🔄 Iniciando migração de campos inline para globais...';
    RAISE NOTICE '📊 Company ID: %', v_company_id;
    
    -- Processar cada categoria
    FOR v_category IN 
        SELECT id, name, config 
        FROM categories 
        WHERE config->'custom_fields' IS NOT NULL
    LOOP
        RAISE NOTICE '📁 Processando categoria: %', v_category.name;
        v_new_fields := '[]'::jsonb;
        
        -- Processar cada campo da categoria
        FOR v_field IN 
            SELECT * FROM jsonb_array_elements(v_category.config->'custom_fields')
        LOOP
            -- Se já tem field_id, manter apenas a referência
            IF v_field.value->>'field_id' IS NOT NULL THEN
                RAISE NOTICE '  ✅ Campo já é referência: %', v_field.value->>'field_id';
                v_new_fields := v_new_fields || jsonb_build_array(
                    jsonb_build_object(
                        'id', v_field.value->>'id',
                        'field_id', v_field.value->>'field_id',
                        'requirement', v_field.value->>'requirement'
                    )
                );
            
            -- Se é campo inline (tem key mas não tem field_id)
            ELSIF v_field.value->>'key' IS NOT NULL THEN
                RAISE NOTICE '  🔄 Migrando campo inline: %', v_field.value->>'name';
                
                -- Verificar se já existe um campo global com essa key
                SELECT id INTO v_field_id
                FROM custom_fields
                WHERE company_id = v_company_id
                  AND key = v_field.value->>'key';
                
                -- Se não existe, criar campo global
                IF v_field_id IS NULL THEN
                    INSERT INTO custom_fields (
                        company_id,
                        key,
                        label,
                        category,
                        field_type,
                        options,
                        placeholder,
                        help_text,
                        table_config,
                        is_system,
                        display_order
                    ) VALUES (
                        v_company_id,
                        v_field.value->>'key',
                        v_field.value->>'name',
                        'spec', -- Categoria padrão
                        -- Mapear tipos customizados para tipos válidos
                        CASE v_field.value->>'type'
                            WHEN 'dropdown' THEN 'select'
                            WHEN 'table_relation' THEN 'table_relation'
                            WHEN 'numeric' THEN 'number'
                            WHEN 'alphanumeric' THEN 'text'
                            WHEN 'capitalize' THEN 'text'
                            WHEN 'uppercase' THEN 'text'
                            WHEN 'lowercase' THEN 'text'
                            WHEN 'titlecase' THEN 'text'
                            WHEN 'sentence' THEN 'text'
                            WHEN 'slug' THEN 'text'
                            WHEN 'phone' THEN 'text'
                            WHEN 'cpf' THEN 'text'
                            WHEN 'cnpj' THEN 'text'
                            WHEN 'cep' THEN 'text'
                            WHEN 'date_br' THEN 'text'
                            WHEN 'date_br_short' THEN 'text'
                            WHEN 'date_iso' THEN 'text'
                            WHEN 'ncm' THEN 'text'
                            WHEN 'ean13' THEN 'text'
                            WHEN 'cest' THEN 'text'
                            WHEN 'brl' THEN 'text'
                            ELSE COALESCE(v_field.value->>'type', 'text')
                        END,
                        CASE 
                            WHEN v_field.value->'options' IS NOT NULL 
                            THEN (v_field.value->'options')::jsonb
                            ELSE '[]'::jsonb
                        END,
                        v_field.value->>'placeholder',
                        v_field.value->>'help_text',
                        v_field.value->'table_config',
                        false,
                        999
                    )
                    RETURNING id INTO v_field_id;
                    
                    RAISE NOTICE '    ➕ Criado campo global: % (ID: %)', v_field.value->>'name', v_field_id;
                ELSE
                    RAISE NOTICE '    ♻️ Campo global já existe: % (ID: %)', v_field.value->>'name', v_field_id;
                END IF;
                
                -- Adicionar referência ao campo global
                v_new_fields := v_new_fields || jsonb_build_array(
                    jsonb_build_object(
                        'id', v_field.value->>'id',
                        'field_id', v_field_id,
                        'requirement', COALESCE(v_field.value->>'requirement', 'optional')
                    )
                );
            END IF;
        END LOOP;
        
        -- Atualizar categoria com novos campos
        UPDATE categories
        SET config = jsonb_set(config, '{custom_fields}', v_new_fields)
        WHERE id = v_category.id;
        
        RAISE NOTICE '  ✅ Categoria atualizada com % campos', jsonb_array_length(v_new_fields);
    END LOOP;
    
    RAISE NOTICE '🎉 Migração concluída!';
END $$;

-- ============================================================================
-- VERIFICAÇÃO: Campos Globais Criados
-- ============================================================================
SELECT 
    '=== CAMPOS GLOBAIS (custom_fields) ===' as info;

SELECT 
    key,
    label,
    field_type,
    CASE 
        WHEN table_config IS NOT NULL THEN '🗄️ ' || (table_config->>'table_name')
        WHEN field_type = 'select' THEN '📋 Dropdown'
        ELSE '📝 ' || field_type
    END as tipo
FROM custom_fields
ORDER BY label;

-- ============================================================================
-- VERIFICAÇÃO: Referências nas Categorias
-- ============================================================================
SELECT 
    '=== CAMPOS NAS CATEGORIAS (apenas referências) ===' as info;

SELECT 
    c.name as categoria,
    cf.label as campo,
    field->>'requirement' as status
FROM categories c,
     jsonb_array_elements(c.config->'custom_fields') as field
LEFT JOIN custom_fields cf ON cf.id::text = field->>'field_id'
ORDER BY c.name, cf.label;

-- ============================================================================
-- INSTRUÇÕES PÓS-MIGRAÇÃO:
-- ============================================================================
-- 1. ✅ Execute este SQL
-- 2. 🔄 Recarregue a página de categorias (Ctrl+F5)
-- 3. ✅ Todos os campos devem aparecer corretamente
-- 4. 🧪 Teste criando um novo produto
-- 5. ✅ Todos os campos devem funcionar normalmente
-- 
-- AGORA:
-- - Todos os campos são GLOBAIS (salvos em custom_fields)
-- - Categorias apenas definem: Oculto / Opcional / Obrigatório
-- - Campos table_relation carregam dados das tabelas do sistema
-- ============================================================================
