-- ============================================================================
-- ATUALIZAR CONSTRAINT DE FIELD_TYPE (VERSÃO SEGURA)
-- ============================================================================
-- Este SQL primeiro remove a constraint e depois adiciona uma nova
-- que aceita TODOS os tipos, incluindo os que já existem no banco
-- ============================================================================

-- Passo 1: Remover a constraint antiga (se existir)
DO $$
BEGIN
    -- Tentar remover a constraint
    ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;
    RAISE NOTICE '✓ Constraint antiga removida';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Aviso: Não foi possível remover constraint antiga (pode não existir)';
END $$;

-- Passo 2: Adicionar nova constraint com TODOS os tipos
DO $$
BEGIN
    ALTER TABLE custom_fields ADD CONSTRAINT custom_fields_field_type_check CHECK (
        field_type IN (
            -- Formatos de Texto
            'text', 'textarea', 'capitalize', 'uppercase', 'lowercase', 'titlecase', 'sentence', 'slug',
            -- Números e Documentos  
            'number', 'numeric', 'alphanumeric', 'phone', 'cpf', 'cnpj', 'cep',
            -- Datas
            'date_br', 'date_br_short', 'date_iso',
            -- Códigos Fiscais
            'ncm', 'ean13', 'cest',
            -- Especializados
            'brl', 'select', 'checkbox', 'table_relation',
            -- Legacy (compatibilidade)
            'dropdown'
        )
    );
    RAISE NOTICE '✓ Nova constraint adicionada com sucesso!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao adicionar constraint: %', SQLERRM;
END $$;

-- Passo 3: Verificar a constraint
SELECT 
    '=== CONSTRAINT ATUALIZADA ===' as info,
    conname as nome_constraint,
    pg_get_constraintdef(oid) as definicao
FROM pg_constraint
WHERE conname = 'custom_fields_field_type_check';

-- Passo 4: Verificar tipos existentes
SELECT 
    '=== TIPOS DE CAMPO EXISTENTES ===' as info,
    field_type,
    COUNT(*) as quantidade
FROM custom_fields
GROUP BY field_type
ORDER BY field_type;
