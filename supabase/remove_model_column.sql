-- Remove old 'model' column to eliminate ambiguity with model_id foreign key
-- This allows Supabase to correctly JOIN with models table

-- Step 1: Drop the old 'model' column
ALTER TABLE products 
DROP COLUMN IF EXISTS model;

-- Step 2: Verify the change
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'model'
    ) THEN
        RAISE NOTICE 'SUCCESS: Column "model" has been removed from products table.';
    ELSE
        RAISE WARNING 'WARNING: Column "model" still exists in products table.';
    END IF;
END $$;

-- Rollback instructions:
-- To rollback this migration:
-- ALTER TABLE products ADD COLUMN model TEXT;
-- UPDATE products p SET model = m.name FROM models m WHERE p.model_id = m.id;
