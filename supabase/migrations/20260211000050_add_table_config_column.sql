-- Step 1: Add table_config column to custom_fields table
-- This allows fields to reference other tables in the database

ALTER TABLE custom_fields
ADD COLUMN IF NOT EXISTS table_config JSONB;

-- Add comment for documentation
COMMENT ON COLUMN custom_fields.table_config IS 'Configuration for fields that reference other tables. Contains: table_name, value_column, label_column, order_by';

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'custom_fields'
  AND column_name = 'table_config';
