-- Verificar campos personalizados existentes
SELECT 
    id,
    key,
    label,
    category,
    field_type,
    is_system,
    table_config
FROM custom_fields
ORDER BY 
    category,
    label;

-- Verificar se há campos na tabela
SELECT COUNT(*) as total_fields FROM custom_fields;

-- Verificar campos por categoria
SELECT 
    category,
    COUNT(*) as count
FROM custom_fields
GROUP BY category
ORDER BY category;
