-- Add extended_warranty_template column to company_settings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'company_settings'
        AND column_name = 'extended_warranty_template'
    ) THEN
        ALTER TABLE public.company_settings
        ADD COLUMN extended_warranty_template text;
    END IF;
END $$;
