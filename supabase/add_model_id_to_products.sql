-- Migration: Add model_id foreign key to products table
-- Created: 2026-02-17
-- Purpose: Make model the single source of truth for brand, category, and dimensions

-- Step 1: Add model_id column (nullable initially to allow population)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS model_id UUID;

-- Step 2: Add foreign key constraint to models table
ALTER TABLE products
ADD CONSTRAINT fk_products_model_id 
FOREIGN KEY (model_id) 
REFERENCES models(id) 
ON DELETE RESTRICT;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_model_id 
ON products(model_id);

-- Step 4: Populate model_id based on existing 'model' field (name)
-- This matches products to models by name
UPDATE products p
SET model_id = m.id
FROM models m
WHERE p.model = m.name
AND p.model_id IS NULL;

-- Step 5: Check for products without model_id (orphaned products)
-- These need manual review
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM products
    WHERE model_id IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'WARNING: % products without model_id found. These need manual review.', orphaned_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All products have model_id assigned.';
    END IF;
END $$;

-- Step 6: Make model_id NOT NULL (only if all products have model_id)
-- Comment this out if you have orphaned products
ALTER TABLE products 
ALTER COLUMN model_id SET NOT NULL;

-- Step 7: Add comment for documentation
COMMENT ON COLUMN products.model_id IS 'Foreign key to models table. Model is the source of truth for brand, category, and dimensions.';

-- Rollback instructions:
-- To rollback this migration:
-- 1. ALTER TABLE products DROP CONSTRAINT fk_products_model_id;
-- 2. DROP INDEX IF EXISTS idx_products_model_id;
-- 3. ALTER TABLE products DROP COLUMN model_id;
