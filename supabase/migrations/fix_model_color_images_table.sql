-- Fix: Recreate model_color_images table with correct structure
-- Run this ONLY if the diagnostic shows the table is missing or has wrong columns

-- Drop existing table if it exists (WARNING: This will delete all data!)
DROP TABLE IF EXISTS model_color_images CASCADE;

-- Create table with correct structure
CREATE TABLE model_color_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    color_id UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
    images TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, model_id, color_id)
);

-- Create indexes
CREATE INDEX idx_model_color_images_company ON model_color_images(company_id);
CREATE INDEX idx_model_color_images_model ON model_color_images(model_id);
CREATE INDEX idx_model_color_images_color ON model_color_images(color_id);

-- Enable RLS
ALTER TABLE model_color_images ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view model_color_images from their company"
    ON model_color_images FOR SELECT
    USING (company_id IN (
        SELECT id FROM companies WHERE slug = 'mercado-do-vale'
    ));

CREATE POLICY "Users can insert model_color_images for their company"
    ON model_color_images FOR INSERT
    WITH CHECK (company_id IN (
        SELECT id FROM companies WHERE slug = 'mercado-do-vale'
    ));

CREATE POLICY "Users can update model_color_images from their company"
    ON model_color_images FOR UPDATE
    USING (company_id IN (
        SELECT id FROM companies WHERE slug = 'mercado-do-vale'
    ))
    WITH CHECK (company_id IN (
        SELECT id FROM companies WHERE slug = 'mercado-do-vale'
    ));

CREATE POLICY "Users can delete model_color_images from their company"
    ON model_color_images FOR DELETE
    USING (company_id IN (
        SELECT id FROM companies WHERE slug = 'mercado-do-vale'
    ));

-- Add comment
COMMENT ON TABLE model_color_images IS 'Stores default images for each model-color variation';

-- Verify the fix
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'model_color_images'
ORDER BY ordinal_position;
