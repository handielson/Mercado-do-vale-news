-- =====================================================
-- ADICIONAR CAMPO DE BENEFICIÁRIO PIX
-- Adiciona coluna para nome do beneficiário da chave PIX
-- =====================================================

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS pix_beneficiary_name TEXT;

COMMENT ON COLUMN company_settings.pix_beneficiary_name IS 'Nome do beneficiário da chave PIX';
