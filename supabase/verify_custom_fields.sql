-- Verificar se o campo "Versão" foi salvo na categoria
SELECT 
    c.id as category_id,
    c.name as category_name,
    c.config->'custom_fields' as custom_fields
FROM categories c
WHERE c.config->'custom_fields' IS NOT NULL
  AND jsonb_array_length(c.config->'custom_fields') > 0;

-- Ver detalhes dos campos personalizados
SELECT 
    c.name as category_name,
    field->>'name' as field_name,
    field->>'key' as field_key,
    field->>'type' as field_type,
    field->>'requirement' as requirement,
    field->'table_config' as table_config
FROM categories c,
     jsonb_array_elements(c.config->'custom_fields') as field
WHERE c.config->'custom_fields' IS NOT NULL
ORDER BY c.name, field->>'name';
