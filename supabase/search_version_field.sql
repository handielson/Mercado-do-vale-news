-- Procurar por qualquer campo com "versão" ou "version" no nome
SELECT 
    c.name as category_name,
    field->>'name' as field_name,
    field->>'key' as field_key,
    field->>'type' as field_type,
    field->'table_config' as table_config
FROM categories c,
     jsonb_array_elements(c.config->'custom_fields') as field
WHERE 
    LOWER(field->>'name') LIKE '%vers%'
    OR LOWER(field->>'key') LIKE '%vers%';

-- Verificar também na tabela custom_fields (se existir)
SELECT 
    id,
    key,
    label,
    field_type,
    table_config,
    created_at
FROM custom_fields
WHERE 
    LOWER(key) LIKE '%vers%'
    OR LOWER(label) LIKE '%vers%'
ORDER BY created_at DESC;
