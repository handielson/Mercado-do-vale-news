-- Fix custom fields that were saved without names
-- This happens when fields were saved as library references without copying the name

-- First, let's see what we have
SELECT 
    c.id as category_id,
    c.name as category_name,
    jsonb_array_length(c.config->'custom_fields') as custom_fields_count,
    c.config->'custom_fields' as custom_fields
FROM categories c
WHERE jsonb_array_length(c.config->'custom_fields') > 0;

-- Option 1: Remove fields without names (safest)
UPDATE categories
SET config = jsonb_set(
    config,
    '{custom_fields}',
    COALESCE(
        (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(config->'custom_fields') elem
            WHERE elem->>'name' IS NOT NULL AND elem->>'name' != ''
        ),
        '[]'::jsonb  -- Default to empty array if all fields are removed
    )
)
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(config->'custom_fields') elem
    WHERE elem->>'name' IS NULL OR elem->>'name' = ''
);

-- Verify the cleanup
SELECT 
    c.id as category_id,
    c.name as category_name,
    jsonb_array_length(c.config->'custom_fields') as custom_fields_count
FROM categories c
WHERE jsonb_array_length(COALESCE(c.config->'custom_fields', '[]'::jsonb)) > 0;
