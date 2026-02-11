-- Verificar como o campo "Versão" está salvo na categoria
SELECT 
    c.name as category_name,
    jsonb_pretty(c.config->'custom_fields') as custom_fields_json
FROM categories c
WHERE c.name = 'Celulares';

-- Verificar se existe na tabela custom_fields
SELECT 
    id,
    key,
    label,
    field_type,
    jsonb_pretty(table_config) as table_config_json,
    created_at
FROM custom_fields
WHERE LOWER(key) LIKE '%vers%'
   OR LOWER(label) LIKE '%vers%';
