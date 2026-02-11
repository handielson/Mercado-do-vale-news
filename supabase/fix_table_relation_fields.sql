-- Fix table_relation fields configuration
-- These fields should be dropdowns, not text inputs

-- 1. Rede Operadora (network type: 4G or 5G)
UPDATE custom_fields
SET 
    field_type = 'select',
    options = ARRAY['4G', '5G', '4G/5G']
WHERE key = 'rede_operadora';

-- 2. NFC (should link to nfc_types table or use select with options)
UPDATE custom_fields
SET 
    field_type = 'select',
    options = ARRAY['Sim', 'Não']
WHERE key = 'nfc';

-- 3. Resistência (should link to resistance_types table or use select)
UPDATE custom_fields
SET 
    field_type = 'select',
    options = ARRAY['IP67', 'IP68', 'IP69', 'Nenhuma']
WHERE key = 'resistencia';

-- 4. Versão (should link to versions table)
UPDATE custom_fields
SET 
    field_type = 'table_relation',
    table_config = jsonb_build_object(
        'table_name', 'versions',
        'value_column', 'id',
        'label_column', 'name',
        'order_by', 'name ASC'
    )
WHERE key = 'versao';

-- Verify the changes
SELECT key, label, field_type, table_config, options
FROM custom_fields
WHERE key IN ('rede_operadora', 'nfc', 'resistencia', 'versao')
ORDER BY label;
