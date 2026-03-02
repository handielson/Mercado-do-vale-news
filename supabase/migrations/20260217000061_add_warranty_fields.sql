-- Add warranty fields to products table
-- Migration: Add warranty_type and warranty_template_id columns

-- Add warranty_type column (enum: brand, category, custom)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS warranty_type TEXT DEFAULT 'brand' CHECK (warranty_type IN ('brand', 'category', 'custom'));

-- Add warranty_template_id column (foreign key to warranty_templates)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS warranty_template_id UUID REFERENCES warranty_templates(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.warranty_type IS 'Type of warranty: brand (from brand), category (from category), or custom (from template)';
COMMENT ON COLUMN products.warranty_template_id IS 'Reference to warranty template when warranty_type is custom';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_warranty_template ON products(warranty_template_id) WHERE warranty_template_id IS NOT NULL;
