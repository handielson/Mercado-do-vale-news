-- Rollback: Restore Fixed Fields from Custom Fields
-- This migration reverses the previous migration
-- Moves fields from custom_fields back to root config

CREATE OR REPLACE FUNCTION rollback_category_fields()
RETURNS void AS $$
DECLARE
    cat RECORD;
    current_config JSONB;
    new_config JSONB;
    custom_fields_array JSONB;
    custom_field JSONB;
    field_key TEXT;
    field_requirement TEXT;
BEGIN
    -- Loop through all categories
    FOR cat IN SELECT id, config FROM categories
    LOOP
        current_config := cat.config;
        custom_fields_array := COALESCE(current_config->'custom_fields', '[]'::JSONB);
        
        -- Start with unique fields and system fields
        new_config := jsonb_build_object(
            'imei1', COALESCE(current_config->>'imei1', 'optional'),
            'imei2', COALESCE(current_config->>'imei2', 'optional'),
            'serial', COALESCE(current_config->>'serial', 'optional'),
            'color', COALESCE(current_config->>'color', 'optional'),
            'ean_autofill_config', COALESCE(current_config->'ean_autofill_config', '{"enabled": true, "exclude_fields": []}'::JSONB),
            'auto_name_fields', COALESCE(current_config->'auto_name_fields', '[]'::JSONB),
            'auto_name_enabled', COALESCE(current_config->'auto_name_enabled', 'false'::JSONB),
            'auto_name_template', COALESCE(current_config->'auto_name_template', '""'::JSONB),
            'auto_name_separator', COALESCE(current_config->'auto_name_separator', '" "'::JSONB),
            'unique_fields', COALESCE(current_config->'unique_fields', '[]'::JSONB)
        );

        -- Convert custom fields back to fixed fields
        FOR custom_field IN SELECT * FROM jsonb_array_elements(custom_fields_array)
        LOOP
            field_key := custom_field->>'key';
            
            -- Only convert known fixed fields
            IF field_key IN ('ram', 'storage', 'version', 'battery_health', 'battery_mah', 'display') THEN
                -- Determine requirement based on required/visible flags
                IF (custom_field->>'required')::boolean THEN
                    field_requirement := 'required';
                ELSIF (custom_field->>'visible')::boolean THEN
                    field_requirement := 'optional';
                ELSE
                    field_requirement := 'off';
                END IF;
                
                -- Add to config
                new_config := new_config || jsonb_build_object(field_key, field_requirement);
            END IF;
        END LOOP;

        -- Keep only non-fixed custom fields
        custom_fields_array := (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(custom_fields_array) elem
            WHERE (elem->>'key') NOT IN ('ram', 'storage', 'version', 'battery_health', 'battery_mah', 'display')
        );

        -- Add remaining custom_fields to new config
        new_config := new_config || jsonb_build_object('custom_fields', COALESCE(custom_fields_array, '[]'::JSONB));

        -- Update category with new config
        UPDATE categories 
        SET config = new_config 
        WHERE id = cat.id;

        RAISE NOTICE 'Rolled back category: % (ID: %)', 
            (SELECT name FROM categories WHERE id = cat.id), cat.id;
    END LOOP;

    RAISE NOTICE 'Rollback completed successfully!';
END;
$$ LANGUAGE plpgsql;

-- Execute the rollback
SELECT rollback_category_fields();

-- Drop the function (cleanup)
DROP FUNCTION rollback_category_fields();

-- Verify rollback
SELECT 
    id,
    name,
    config->'ram' as ram,
    config->'storage' as storage,
    config->'battery_health' as battery_health,
    config->'display' as display,
    jsonb_array_length(COALESCE(config->'custom_fields', '[]'::JSONB)) as custom_fields_count
FROM categories
ORDER BY name;
