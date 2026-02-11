-- ============================================================================
-- ATUALIZAR CONSTRAINT DE FIELD_TYPE PARA ACEITAR TODOS OS TIPOS
-- ============================================================================
-- Este SQL atualiza a constraint custom_fields_field_type_check para aceitar
-- todos os tipos de campo disponíveis no sistema
-- ============================================================================

-- Remover constraint antiga
ALTER TABLE custom_fields 
DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;

-- Adicionar nova constraint com todos os tipos
ALTER TABLE custom_fields
ADD CONSTRAINT custom_fields_field_type_check 
CHECK (field_type IN (
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
    -- Legacy (manter compatibilidade)
    'dropdown'
));

-- Verificar constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'custom_fields_field_type_check';

-- Mensagem de sucesso
SELECT '✅ Constraint atualizada com sucesso! Agora aceita todos os tipos de campo.' as status;
