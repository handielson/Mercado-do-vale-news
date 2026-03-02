-- Step 2: Update existing fields to use table_relation type
-- Migrating: version, ram, storage, color, battery_health

-- 1. Version → versions table
UPDATE custom_fields
SET 
  field_type = 'table_relation',
  table_config = jsonb_build_object(
    'table_name', 'versions',
    'value_column', 'id',
    'label_column', 'name',
    'order_by', 'name ASC'
  )
WHERE key = 'version';

-- 2. RAM → rams table
UPDATE custom_fields
SET 
  field_type = 'table_relation',
  table_config = jsonb_build_object(
    'table_name', 'rams',
    'value_column', 'id',
    'label_column', 'name',
    'order_by', 'name ASC'
  )
WHERE key = 'ram';

-- 3. Storage → storages table
UPDATE custom_fields
SET 
  field_type = 'table_relation',
  table_config = jsonb_build_object(
    'table_name', 'storages',
    'value_column', 'id',
    'label_column', 'name',
    'order_by', 'name ASC'
  )
WHERE key = 'storage';

-- 4. Battery Health → battery_healths table
UPDATE custom_fields
SET 
  field_type = 'table_relation',
  table_config = jsonb_build_object(
    'table_name', 'battery_healths',
    'value_column', 'id',
    'label_column', 'name',
    'order_by', 'name ASC'
  )
WHERE key = 'battery_health';

-- 5. Display → (if exists)
-- UPDATE custom_fields
-- SET 
--   field_type = 'table_relation',
--   table_config = jsonb_build_object(
--     'table_name', 'displays',
--     'value_column', 'id',
--     'label_column', 'name',
--     'order_by', 'name ASC'
--   )
-- WHERE key = 'display';

-- Verify updates
SELECT 
  key,
  label,
  field_type,
  table_config
FROM custom_fields
WHERE key IN ('version', 'ram', 'storage', 'battery_health')
ORDER BY key;
