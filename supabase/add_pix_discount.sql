-- Add pix discount percentage to company settings
ALTER TABLE IF EXISTS company_settings 
ADD COLUMN IF NOT EXISTS pix_discount_percentage numeric DEFAULT 0;

COMMENT ON COLUMN company_settings.pix_discount_percentage IS 'Porcentagem de desconto automático para pagamentos via PIX';
