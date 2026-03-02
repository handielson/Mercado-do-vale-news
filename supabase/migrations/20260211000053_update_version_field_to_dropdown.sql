-- Update "version" field to be a dropdown that loads from versions table
-- This maintains the original behavior where users select from a list

UPDATE custom_fields
SET 
    field_type = 'dropdown',
    options = (
        SELECT jsonb_agg(name ORDER BY name)
        FROM versions
        WHERE company_id = custom_fields.company_id
    ),
    metadata = jsonb_build_object(
        'source', 'table',
        'table_name', 'versions',
        'value_column', 'name',
        'label_column', 'name',
        'auto_refresh', true
    )
WHERE key = 'version';

-- Verify the update
SELECT 
    id,
    key,
    label,
    field_type,
    options,
    metadata
FROM custom_fields
WHERE key = 'version';
