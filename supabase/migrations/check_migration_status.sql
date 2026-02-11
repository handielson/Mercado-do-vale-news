-- Diagnostic: Check what already exists
-- Run this first to see what's already in the database

SELECT 
    'Table exists' as status,
    'model_color_images' as object_name
FROM information_schema.tables 
WHERE table_name = 'model_color_images'

UNION ALL

SELECT 
    'Index exists' as status,
    indexname as object_name
FROM pg_indexes 
WHERE indexname IN (
    'idx_model_color_images_model',
    'idx_model_color_images_color', 
    'idx_model_color_images_company'
)

UNION ALL

SELECT 
    'Column exists' as status,
    'products.custom_images' as object_name
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name = 'custom_images'

UNION ALL

SELECT 
    'Policy exists' as status,
    policyname as object_name
FROM pg_policies
WHERE tablename = 'model_color_images';
