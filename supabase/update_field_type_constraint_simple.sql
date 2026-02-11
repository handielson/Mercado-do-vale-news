-- Remover constraint antiga
ALTER TABLE custom_fields DROP CONSTRAINT IF EXISTS custom_fields_field_type_check;

-- Adicionar nova constraint com todos os tipos
ALTER TABLE custom_fields ADD CONSTRAINT custom_fields_field_type_check CHECK (
    field_type IN (
        'text', 'textarea', 'capitalize', 'uppercase', 'lowercase', 'titlecase', 'sentence', 'slug',
        'number', 'numeric', 'alphanumeric', 'phone', 'cpf', 'cnpj', 'cep',
        'date_br', 'date_br_short', 'date_iso',
        'ncm', 'ean13', 'cest',
        'brl', 'select', 'checkbox', 'table_relation', 'dropdown'
    )
);
