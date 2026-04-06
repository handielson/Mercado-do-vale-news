-- Add receipt extra page fields to company_settings table
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS receipt_extra_page_text TEXT,
ADD COLUMN IF NOT EXISTS receipt_extra_page_qr_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_show_extra_page BOOLEAN DEFAULT false;

-- Add helpful comment for future logic
COMMENT ON COLUMN company_settings.receipt_extra_page_text IS 'Configurable text (supports tags) for the extra receipt page';
COMMENT ON COLUMN company_settings.receipt_extra_page_qr_url IS 'URL to generate an access QR Code on the extra page';
COMMENT ON COLUMN company_settings.receipt_show_extra_page IS 'Toggle to print the extra settings / QR page at the end of receipts';
