-- Migration: Add Model Color Images System and Product Condition
-- Created: 2026-02-10
-- Purpose: Enable shared image galleries for NEW products (Model+Color) and individual images for USED products

-- =====================================================
-- 1. CREATE model_color_images TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS model_color_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    color_id UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique ordering per model+color combination
    CONSTRAINT unique_model_color_order UNIQUE (model_id, color_id, display_order)
);

-- =====================================================
-- 2. ADD condition FIELD TO products TABLE
-- =====================================================
-- Add condition field (NOVO or USADO)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'condition'
    ) THEN
        ALTER TABLE products 
        ADD COLUMN condition VARCHAR(10) DEFAULT 'NOVO' CHECK (condition IN ('NOVO', 'USADO'));
    END IF;
END $$;

-- =====================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_model_color_images_model_color 
    ON model_color_images(model_id, color_id);

CREATE INDEX IF NOT EXISTS idx_model_color_images_company 
    ON model_color_images(company_id);

CREATE INDEX IF NOT EXISTS idx_model_color_images_order 
    ON model_color_images(model_id, color_id, display_order);

CREATE INDEX IF NOT EXISTS idx_products_condition 
    ON products(condition);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE model_color_images ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view images from their company
CREATE POLICY "Users can view model_color_images from their company"
    ON model_color_images
    FOR SELECT
    USING (
        company_id IN (
            SELECT id FROM companies WHERE slug = 'mercado-do-vale'
        )
    );

-- Policy: Users can insert images for their company
CREATE POLICY "Users can insert model_color_images for their company"
    ON model_color_images
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT id FROM companies WHERE slug = 'mercado-do-vale'
        )
    );

-- Policy: Users can update images from their company
CREATE POLICY "Users can update model_color_images from their company"
    ON model_color_images
    FOR UPDATE
    USING (
        company_id IN (
            SELECT id FROM companies WHERE slug = 'mercado-do-vale'
        )
    );

-- Policy: Users can delete images from their company
CREATE POLICY "Users can delete model_color_images from their company"
    ON model_color_images
    FOR DELETE
    USING (
        company_id IN (
            SELECT id FROM companies WHERE slug = 'mercado-do-vale'
        )
    );

-- =====================================================
-- 5. TRIGGER FOR updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_model_color_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_color_images_updated_at
    BEFORE UPDATE ON model_color_images
    FOR EACH ROW
    EXECUTE FUNCTION update_model_color_images_updated_at();

-- =====================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE model_color_images IS 'Stores shared image galleries for products with same Model+Color combination. Used only for NEW products.';
COMMENT ON COLUMN model_color_images.display_order IS 'Order of image display. First image (order=1) is the cover/main image.';
COMMENT ON COLUMN products.condition IS 'Product condition: NOVO (new, uses shared images) or USADO (used, uses individual images in products.images[])';
