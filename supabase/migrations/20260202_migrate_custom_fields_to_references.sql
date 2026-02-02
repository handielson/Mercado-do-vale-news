-- Migration: Convert Custom Fields to Reference-Based Architecture
-- Date: 2026-02-02
-- Description: Converts inline custom fields in categories to reference-based format
--              Maintains backward compatibility by keeping original data as fallback

DO $$
DECLARE
    v_category RECORD;
    v_field JSONB;
    v_library_field RECORD;
    v_new_fields JSONB := '[]'::jsonb;
    v_converted_count INTEGER := 0;
    v_kept_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Starting custom fields migration...';
    
    -- Loop through all categories
    FOR v_category IN 
        SELECT id, name, config 
        FROM categories 
        WHERE config ? 'custom_fields'
    LOOP
        RAISE NOTICE '📦 Processing category: %', v_category.name;
        v_new_fields := '[]'::jsonb;
        
        -- Loop through each custom field in the category
        FOR v_field IN 
            SELECT * FROM jsonb_array_elements(v_category.config->'custom_fields')
        LOOP
            -- Check if field already has field_id (already migrated)
            IF v_field ? 'field_id' THEN
                RAISE NOTICE '  ✅ Field already migrated, keeping as is';
                v_new_fields := v_new_fields || v_field;
                v_kept_count := v_kept_count + 1;
                CONTINUE;
            END IF;
            
            -- Try to find matching field in library by key
            SELECT * INTO v_library_field
            FROM custom_fields
            WHERE key = v_field->>'key'
            LIMIT 1;
            
            IF FOUND THEN
                -- Convert to reference format
                RAISE NOTICE '  🔄 Converting field: % → field_id: %', 
                    v_field->>'name', v_library_field.id;
                
                v_new_fields := v_new_fields || jsonb_build_object(
                    'id', v_field->>'id',
                    'field_id', v_library_field.id,
                    'requirement', v_field->>'requirement',
                    '_legacy', v_field  -- Backup of original data
                );
                v_converted_count := v_converted_count + 1;
            ELSE
                -- No matching library field, keep inline format
                RAISE NOTICE '  ⚠️  No library match for %, keeping inline', 
                    v_field->>'name';
                v_new_fields := v_new_fields || v_field;
                v_kept_count := v_kept_count + 1;
            END IF;
        END LOOP;
        
        -- Update category with new fields
        UPDATE categories
        SET config = jsonb_set(
            config,
            '{custom_fields}',
            v_new_fields
        )
        WHERE id = v_category.id;
        
        RAISE NOTICE '  ✅ Category updated';
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '📊 Statistics:';
    RAISE NOTICE '   - Converted to references: %', v_converted_count;
    RAISE NOTICE '   - Kept inline: %', v_kept_count;
    RAISE NOTICE '   - Total fields: %', v_converted_count + v_kept_count;
END $$;

-- Verify migration
SELECT 
    c.name AS category,
    jsonb_array_length(c.config->'custom_fields') AS total_fields,
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(c.config->'custom_fields') AS f
        WHERE f ? 'field_id'
    ) AS reference_fields,
    (
        SELECT COUNT(*)
        FROM jsonb_array_elements(c.config->'custom_fields') AS f
        WHERE NOT (f ? 'field_id')
    ) AS inline_fields
FROM categories c
WHERE c.config ? 'custom_fields'
ORDER BY c.name;
