-- Final cleanup: Remove old columns and add constraints
-- Execute this in Supabase SQL Editor

-- Step 1: Remove old columns
ALTER TABLE model_color_images 
DROP COLUMN IF EXISTS image_url CASCADE;

ALTER TABLE model_color_images 
DROP COLUMN IF EXISTS display_order CASCADE;

-- Step 2: Add UNIQUE constraint
ALTER TABLE model_color_images 
DROP CONSTRAINT IF EXISTS model_color_images_company_id_model_id_color_id_key;

ALTER TABLE model_color_images 
ADD CONSTRAINT model_color_images_company_id_model_id_color_id_key 
UNIQUE (company_id, model_id, color_id);

-- Step 3: Make images column NOT NULL
ALTER TABLE model_color_images 
ALTER COLUMN images SET NOT NULL;

ALTER TABLE model_color_images 
ALTER COLUMN images SET DEFAULT '{}';

-- Step 4: Verify final structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'model_color_images'
ORDER BY ordinal_position;

-- Step 5: Verify constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'model_color_images'::regclass;
