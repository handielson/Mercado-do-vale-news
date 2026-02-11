-- Verificar se o campo "version" foi criado corretamente
SELECT 
    id,
    key,
    label,
    category,
    field_type,
    is_system
FROM custom_fields
WHERE key = 'version'
ORDER BY company_id;

-- Se não existir, criar:
-- INSERT INTO custom_fields (company_id, key, label, category, field_type, is_system, display_order)
-- SELECT 
--     id as company_id,
--     'version' as key,
--     'Versão' as label,
--     'spec' as category,
--     'text' as field_type,
--     true as is_system,
--     10 as display_order
-- FROM companies
-- WHERE NOT EXISTS (
--     SELECT 1 FROM custom_fields WHERE key = 'version' AND company_id = companies.id
-- );
