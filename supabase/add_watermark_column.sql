-- Adiciona a coluna para a marca d'água de marketing na tabela de configurações da empresa
ALTER TABLE IF EXISTS company_settings 
ADD COLUMN IF NOT EXISTS watermark_url text;

-- Add description for PostgREST
COMMENT ON COLUMN company_settings.watermark_url IS 'URL or Base64 of the logo used as watermark in marketing assets';
