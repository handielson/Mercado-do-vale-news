-- Verificar campos sem label/name
SELECT 
    id,
    key,
    label,
    name,
    field_type,
    category
FROM custom_fields
WHERE label IS NULL OR label = '' OR name IS NULL OR name = ''
ORDER BY created_at DESC;

-- Ver todos os campos recentes
SELECT 
    id,
    key,
    label,
    field_type,
    category,
    created_at
FROM custom_fields
ORDER BY created_at DESC
LIMIT 20;
