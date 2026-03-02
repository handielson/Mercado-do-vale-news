-- Migration: Add Model-Color Images System
-- Description: Create table to store images per model-color variation
-- This reduces image duplication and improves performance

-- Create model_color_images table
CREATE TABLE IF NOT EXISTS model_color_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    color_id UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
    images TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_model_color UNIQUE(model_id, color_id)
);

-- Create indexes for performance
CREATE INDEX idx_model_color_images_model ON model_color_images(model_id);
CREATE INDEX idx_model_color_images_color ON model_color_images(color_id);
CREATE INDEX idx_model_color_images_company ON model_color_images(company_id);

-- Add custom_images column to products
-- NULL = use default images from model_color_images
-- Array = custom images (for used products)
ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_images TEXT[];

-- Add comment for documentation
COMMENT ON TABLE model_color_images IS 'Stores default images for each model-color variation';
COMMENT ON COLUMN products.custom_images IS 'Custom images for this specific product (used products). NULL means use default from model_color_images';

-- Enable RLS
ALTER TABLE model_color_images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view model_color_images from their company"
    ON model_color_images FOR SELECT
    USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert model_color_images for their company"
    ON model_color_images FOR INSERT
    WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update model_color_images from their company"
    ON model_color_images FOR UPDATE
    USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete model_color_images from their company"
    ON model_color_images FOR DELETE
    USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));
