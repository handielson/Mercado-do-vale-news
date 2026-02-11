-- Migration: Move "version" from fixed field to custom field
-- Step 1 of N: Migrating field by field to avoid bugs

-- This migration:
-- 1. Keeps config.version value (required/optional/off)
-- 2. Removes "version" from FieldConfigSection display (done in frontend)
-- 3. Field "version" now appears in custom fields section

-- NOTE: No database changes needed!
-- The field "version" already exists in config and will continue to work.
-- We just need to update the frontend to:
-- 1. Remove "version" from FieldConfigSection
-- 2. Add "version" to the list of custom fields to display

-- Verification query
SELECT 
    id,
    name,
    config->'version' as version_config,
    config->'custom_fields' as custom_fields
FROM categories
ORDER BY name;

-- Expected result:
-- version_config should still exist (e.g., "optional", "required", "off")
-- This value will now be read by the custom fields system instead of fixed fields
