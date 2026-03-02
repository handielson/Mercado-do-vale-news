-- Migration: Convert model_color_images to use images array
-- This will preserve any existing data by migrating it to the new structure

-- Step 1: Backup existing data (if any)
CREATE TEMP TABLE temp_model_color_images_backup AS
SELECT 
    company_id,
    model_id,
    color_id,
    image_url,
    display_order
FROM model_color_images;

-- Step 2: Drop the old table
DROP TABLE model_color_images CASCADE;

-- Step 3: Create new table with correct structure
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

-- Step 4: Migrate old data (if any existed)
-- Group images by company_id, model_id, color_id and create arrays
INSERT INTO model_color_images (company_id, model_id, color_id, images)
SELECT 
    company_id,
    model_id,
    color_id,
    array_agg(image_url ORDER BY display_order) as images
FROM temp_model_color_images_backup
GROUP BY company_id, model_id, color_id;

-- Step 5: Create indexes
CREATE INDEX idx_model_color_images_company ON model_color_images(company_id);
CREATE INDEX idx_model_color_images_model ON model_color_images(model_id);
CREATE INDEX idx_model_color_images_color ON model_color_images(color_id);

-- Step 6: Enable RLS
ALTER TABLE model_color_images ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies
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

-- Step 8: Add comment
COMMENT ON TABLE model_color_images IS 'Stores default images for each model-color variation as an array';

-- Step 9: Verify the migration
SELECT 
    'Migration completed!' as status,
    COUNT(*) as migrated_records
FROM model_color_images;

-- Step 10: Show new structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'model_color_images'
ORDER BY ordinal_position;
