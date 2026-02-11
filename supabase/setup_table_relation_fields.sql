-- ============================================================================
-- SETUP COMPLETO: Sistema de Campos Personalizados com Relacionamento de Tabelas
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor
-- ============================================================================

-- PASSO 1: Atualizar constraint para aceitar table_relation
-- ============================================================================
DO $$
BEGIN
    -- Remover constraint antiga
    ALTER TABLE custom_fields 
    DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;
    
    -- Adicionar nova constraint com table_relation
    ALTER TABLE custom_fields
    ADD CONSTRAINT custom_fields_field_type_check 
    CHECK (field_type IN ('text', 'number', 'select', 'checkbox', 'textarea', 'table_relation'));
    
    RAISE NOTICE '✅ Constraint atualizada para aceitar table_relation';
END $$;

-- PASSO 2: Adicionar coluna table_config na tabela custom_fields
-- ============================================================================
DO $$
BEGIN
    -- Verificar se a coluna já existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'custom_fields' 
        AND column_name = 'table_config'
    ) THEN
        -- Adicionar coluna
        ALTER TABLE custom_fields
        ADD COLUMN table_config JSONB;
        
        -- Adicionar comentário
        COMMENT ON COLUMN custom_fields.table_config IS 
            'Configuration for table_relation fields (table_name, value_column, label_column, order_by)';
        
        RAISE NOTICE '✅ Coluna table_config adicionada com sucesso!';
    ELSE
        RAISE NOTICE '⚠️ Coluna table_config já existe, pulando...';
    END IF;
END $$;

-- PASSO 3: Limpar campos "Versão" incompletos das categorias
-- ============================================================================
UPDATE categories
SET config = jsonb_set(
    config,
    '{custom_fields}',
    COALESCE(
        (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(config->'custom_fields') elem
            WHERE NOT (
                elem->>'key' = 'versao' 
                AND elem->>'type' = 'text'
                AND elem->'table_config' IS NULL
            )
        ),
        '[]'::jsonb
    )
)
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(config->'custom_fields') elem
    WHERE elem->>'key' = 'versao' 
      AND elem->>'type' = 'text'
      AND elem->'table_config' IS NULL
);

-- PASSO 4: Criar campo "Versão" global na tabela custom_fields (se não existir)
-- ============================================================================
DO $$
DECLARE
    v_company_id UUID;
    v_field_id UUID;
BEGIN
    -- Pegar o primeiro company_id (ajuste se necessário)
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION '❌ Nenhuma empresa encontrada! Crie uma empresa primeiro.';
    END IF;
    
    -- Verificar se o campo já existe
    SELECT id INTO v_field_id 
    FROM custom_fields 
    WHERE company_id = v_company_id 
      AND key = 'versao';
    
    IF v_field_id IS NULL THEN
        -- Criar campo global
        INSERT INTO custom_fields (
            company_id,
            key,
            label,
            category,
            field_type,
            table_config,
            is_system,
            display_order
        ) VALUES (
            v_company_id,
            'versao',
            'Versão',
            'spec',
            'table_relation',
            jsonb_build_object(
                'table_name', 'versions',
                'value_column', 'id',
                'label_column', 'name',
                'order_by', 'name ASC'
            ),
            false,
            10
        )
        RETURNING id INTO v_field_id;
        
        RAISE NOTICE '✅ Campo "Versão" criado com ID: %', v_field_id;
    ELSE
        -- Atualizar campo existente para table_relation
        UPDATE custom_fields
        SET 
            field_type = 'table_relation',
            table_config = jsonb_build_object(
                'table_name', 'versions',
                'value_column', 'id',
                'label_column', 'name',
                'order_by', 'name ASC'
            )
        WHERE id = v_field_id;
        
        RAISE NOTICE '✅ Campo "Versão" atualizado para table_relation';
    END IF;
END $$;

-- PASSO 5: Verificar o resultado
-- ============================================================================
SELECT 
    '=== VERIFICAÇÃO: Campo Versão ===' as info;

SELECT 
    id,
    key,
    label,
    field_type,
    jsonb_pretty(table_config) as table_config
FROM custom_fields
WHERE key = 'versao';

SELECT 
    '=== VERIFICAÇÃO: Campos nas Categorias ===' as info;

SELECT 
    c.name as category_name,
    field->>'name' as field_name,
    field->>'key' as field_key,
    field->>'type' as field_type,
    field->>'field_id' as field_id_reference,
    field->'table_config' as table_config
FROM categories c,
     jsonb_array_elements(c.config->'custom_fields') as field
WHERE field->>'key' = 'versao'
   OR field->>'name' ILIKE '%vers%';

-- ============================================================================
-- INSTRUÇÕES PÓS-EXECUÇÃO:
-- ============================================================================
-- 1. ✅ Execute este SQL completo no Supabase
-- 2. 🔄 Recarregue a página de categorias no navegador
-- 3. ➕ Adicione o campo "Versão" à categoria "Celulares":
--    - Vá em Configurações > Categorias > Editar "Celulares"
--    - Clique em "Adicionar Campo"
--    - Selecione "Versão" do dicionário
--    - Defina como Obrigatório/Opcional
--    - Salve a categoria
-- 4. 🧪 Teste criando um novo produto
-- 5. ✅ O campo "Versão" deve aparecer como dropdown com opções da tabela versions
-- ============================================================================
