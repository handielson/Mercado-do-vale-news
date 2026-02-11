-- Migration: Convert Fixed Fields to Custom Fields
-- This migration moves all non-unique fields from category.config to category.config.custom_fields
-- Keeps only unique fields (imei1, imei2, serial, color) in the root config

-- Step 1: Create a function to migrate fields for each category
CREATE OR REPLACE FUNCTION migrate_category_fields_to_custom()
RETURNS void AS $$
DECLARE
    cat RECORD;
    current_config JSONB;
    new_config JSONB;
    custom_fields_array JSONB;
    field_name TEXT;
    field_value TEXT;
    field_mapping JSONB;
BEGIN
    -- Field mapping: old key -> {label, type}
    field_mapping := '{
        "ram": {"label": "RAM", "type": "text"},
        "storage": {"label": "Armazenamento", "type": "text"},
        "version": {"label": "Versão", "type": "text"},
        "battery_health": {"label": "Saúde da Bateria", "type": "number"},
        "battery_mah": {"label": "Bateria (mAh)", "type": "number"},
        "display": {"label": "Display (pol)", "type": "text"}
    }'::JSONB;

    -- Loop through all categories
    FOR cat IN SELECT id, config FROM categories
    LOOP
        current_config := cat.config;
        custom_fields_array := COALESCE(current_config->'custom_fields', '[]'::JSONB);
        
        -- Build new config with only unique fields and system fields
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

        -- Convert each fixed field to custom field
        FOR field_name IN SELECT jsonb_object_keys(field_mapping)
        LOOP
            -- Check if field exists in current config
            IF current_config ? field_name THEN
                field_value := current_config->>field_name;
                
                -- Only add if not already in custom_fields
                IF NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(custom_fields_array) elem
                    WHERE elem->>'key' = field_name
                ) THEN
                    -- Add to custom_fields array
                    custom_fields_array := custom_fields_array || jsonb_build_array(
                        jsonb_build_object(
                            'key', field_name,
                            'label', field_mapping->field_name->>'label',
                            'type', field_mapping->field_name->>'type',
                            'required', CASE WHEN field_value = 'required' THEN true ELSE false END,
                            'visible', CASE WHEN field_value = 'off' THEN false ELSE true END
                        )
                    );
                END IF;
            END IF;
        END LOOP;

        -- Add custom_fields to new config
        new_config := new_config || jsonb_build_object('custom_fields', custom_fields_array);

        -- Update category with new config
        UPDATE categories 
        SET config = new_config 
        WHERE id = cat.id;

        RAISE NOTICE 'Migrated category: % (ID: %)', 
            (SELECT name FROM categories WHERE id = cat.id), cat.id;
    END LOOP;

    RAISE NOTICE 'Migration completed successfully!';
END;
$$ LANGUAGE plpgsql;

-- Step 2: Execute the migration
SELECT migrate_category_fields_to_custom();

-- Step 3: Drop the function (cleanup)
DROP FUNCTION migrate_category_fields_to_custom();

-- Step 4: Verify migration
SELECT 
    id,
    name,
    config->'imei1' as imei1,
    config->'imei2' as imei2,
    config->'serial' as serial,
    config->'color' as color,
    jsonb_array_length(config->'custom_fields') as custom_fields_count
FROM categories
ORDER BY name;
