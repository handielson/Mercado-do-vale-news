-- Migration: Add EAN support to models table
-- Purpose: Allow models to have EAN codes for product identification via barcode scanning
-- Date: 2026-02-11

-- Add eans column to models table (array of text)
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS eans text[] DEFAULT '{}';

-- Add comment explaining the field
COMMENT ON COLUMN models.eans IS 'Array of EAN/GTIN codes associated with this model. Used for product identification via barcode scanning. Each product will have its own unique EAN, but models can have reference EANs for quick identification.';

-- Create index for faster EAN lookups
CREATE INDEX IF NOT EXISTS idx_models_eans ON models USING GIN (eans);
