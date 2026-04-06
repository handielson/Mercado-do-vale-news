-- Add holiday_overrides column to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS holiday_overrides JSONB DEFAULT '[]'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN company_settings.holiday_overrides IS 'Array of holiday dates (YYYY-MM-DD) that the store will be forced open, bypassing the default holiday closure rule';
