-- Migration: Add EAN support to models table
-- Execute this SQL directly in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Add eans column to models table (array of text)
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS eans text[] DEFAULT '{}';

-- Add comment explaining the field
COMMENT ON COLUMN models.eans IS 'Array of EAN/GTIN codes associated with this model. Used for product identification via barcode scanning. Each product will have its own unique EAN, but models can have reference EANs for quick identification.';

-- Create index for faster EAN lookups
CREATE INDEX IF NOT EXISTS idx_models_eans ON models USING GIN (eans);

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'models' AND column_name = 'eans';
