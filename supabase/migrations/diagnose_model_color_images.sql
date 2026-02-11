-- Diagnostic: Check model_color_images table structure
-- Run this in Supabase SQL Editor to verify the table exists and has correct columns

-- 1. Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'model_color_images'
) as table_exists;

-- 2. Check all columns in the table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'model_color_images'
ORDER BY ordinal_position;

-- 3. Check if there's any data
SELECT COUNT(*) as total_rows FROM model_color_images;

-- 4. Try to select from the table
SELECT * FROM model_color_images LIMIT 1;

-- 5. Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'model_color_images';
