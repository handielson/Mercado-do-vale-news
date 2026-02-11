-- Complete Migration: Add missing pieces
-- This completes what's missing from the model_color_images migration

-- 1. Add missing indexes
CREATE INDEX IF NOT EXISTS idx_model_color_images_model ON model_color_images(model_id);
CREATE INDEX IF NOT EXISTS idx_model_color_images_color ON model_color_images(color_id);

-- 2. Add custom_images column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_images TEXT[];

-- 3. Add documentation comments
COMMENT ON COLUMN products.custom_images IS 'Custom images for this specific product (used products). NULL means use default from model_color_images';

-- Verify completion
SELECT 
    'Migration completed!' as status,
    COUNT(*) as total_indexes
FROM pg_indexes 
WHERE indexname IN (
    'idx_model_color_images_model',
    'idx_model_color_images_color', 
    'idx_model_color_images_company'
);
