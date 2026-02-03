-- =====================================================
-- ADICIONAR COLUNAS FALTANTES - company_settings
-- Adiciona colunas da Receita Federal que estão faltando
-- =====================================================

-- Adicionar coluna state_registration (IE - Inscrição Estadual)
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS state_registration TEXT;

-- Adicionar outras colunas da Receita Federal se não existirem
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS cnae TEXT;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS situacao_cadastral TEXT;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS data_abertura DATE;

ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS porte TEXT;

-- Comentários para documentação
COMMENT ON COLUMN company_settings.state_registration IS 'Inscrição Estadual (IE)';
COMMENT ON COLUMN company_settings.cnae IS 'CNAE Principal da empresa';
COMMENT ON COLUMN company_settings.situacao_cadastral IS 'Situação cadastral na Receita Federal';
COMMENT ON COLUMN company_settings.data_abertura IS 'Data de abertura da empresa';
COMMENT ON COLUMN company_settings.porte IS 'Porte da empresa (MEI, ME, EPP, etc.)';
