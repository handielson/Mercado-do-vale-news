-- Simple migration: Add images column and migrate data
-- Execute this in Supabase SQL Editor

-- Step 1: Add the new images column
ALTER TABLE model_color_images 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Step 2: Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'model_color_images' 
AND column_name = 'images';
