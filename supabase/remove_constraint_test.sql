-- Verificar a constraint atual
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'custom_fields'::regclass
  AND contype = 'c';

-- Se a constraint existir, vamos forçar a remoção e recriação
DO $$
BEGIN
    -- Forçar remoção
    EXECUTE 'ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check CASCADE';
    
    -- Recriar sem constraint temporariamente para testar
    RAISE NOTICE 'Constraint removida. Teste salvar o campo agora.';
END $$;

-- Depois de testar, execute este bloco para adicionar a constraint novamente:
/*
ALTER TABLE custom_fields ADD CONSTRAINT custom_fields_field_type_check CHECK (
    field_type IN (
        'text', 'textarea', 'capitalize', 'uppercase', 'lowercase', 'titlecase', 'sentence', 'slug',
        'number', 'numeric', 'alphanumeric', 'phone', 'cpf', 'cnpj', 'cep',
        'date_br', 'date_br_short', 'date_iso',
        'ncm', 'ean13', 'cest',
        'brl', 'select', 'checkbox', 'table_relation', 'dropdown'
    )
);
*/
