-- Migration: Add unit_status to products table
-- Date: 2026-02-01
-- Purpose: Track individual status of serialized products

-- Add unit_status column
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS unit_status VARCHAR(20) DEFAULT 'available';

-- Add constraint to ensure valid values
ALTER TABLE products
ADD CONSTRAINT check_unit_status 
CHECK (unit_status IN ('available', 'reserved', 'sold', 'maintenance', 'defective'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_unit_status ON products(unit_status);

-- Create index for serialized product queries
CREATE INDEX IF NOT EXISTS idx_products_specs_imei1 ON products((specs->>'imei1'));
CREATE INDEX IF NOT EXISTS idx_products_specs_serial ON products((specs->>'serial'));

-- Update existing products to 'available' status
UPDATE products 
SET unit_status = 'available' 
WHERE unit_status IS NULL;

-- Add comment
COMMENT ON COLUMN products.unit_status IS 'Status of individual unit: available, reserved, sold, maintenance, defective';
