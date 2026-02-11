-- Verificar quais campos estão na tabela custom_fields
SELECT 
    id,
    key,
    label,
    field_type,
    category,
    is_system
FROM custom_fields
ORDER BY display_order, label;

-- Verificar quais campos estão nas categorias
SELECT 
    c.name as categoria,
    jsonb_array_length(c.config->'custom_fields') as total_campos,
    c.config->'custom_fields' as campos
FROM categories c
WHERE c.name ILIKE '%celular%'
ORDER BY c.name;
