-- Migration: Add Warranty System
-- Created: 2026-02-04
-- Description: Adds warranty configuration to brands, categories, and products

-- Add warranty_days to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 90;
COMMENT ON COLUMN brands.warranty_days IS 'Período de garantia padrão em dias para produtos desta marca';

-- Add warranty_days to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 90;
COMMENT ON COLUMN categories.warranty_days IS 'Período de garantia padrão em dias para produtos desta categoria';

-- Add warranty fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_type VARCHAR(20) DEFAULT 'brand';
COMMENT ON COLUMN products.warranty_type IS 'Tipo de garantia: brand (usa da marca), category (usa da categoria), ou custom (texto personalizado)';

ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_custom_text TEXT;
COMMENT ON COLUMN products.warranty_custom_text IS 'Texto personalizado de garantia (usado apenas quando warranty_type = custom)';

-- Add check constraint to ensure warranty_type has valid values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_warranty_type_check'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_warranty_type_check 
        CHECK (warranty_type IN ('brand', 'category', 'custom'));
    END IF;
END $$;
