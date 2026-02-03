-- Migration: Add Receita Federal fields to company_settings table
-- Date: 2026-02-03
-- Description: Adds razao_social, cnae, situacao_cadastral, data_abertura, and porte columns

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add razao_social column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'razao_social'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN razao_social TEXT;
  END IF;

  -- Add cnae column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'cnae'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN cnae TEXT;
  END IF;

  -- Add situacao_cadastral column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'situacao_cadastral'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN situacao_cadastral TEXT;
  END IF;

  -- Add data_abertura column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'data_abertura'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN data_abertura DATE;
  END IF;

  -- Add porte column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'porte'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN porte TEXT;
  END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN company_settings.razao_social IS 'Razão Social (nome oficial da empresa)';
COMMENT ON COLUMN company_settings.cnae IS 'CNAE Principal (código e descrição da atividade econômica)';
COMMENT ON COLUMN company_settings.situacao_cadastral IS 'Situação Cadastral na Receita Federal (Ativa, Suspensa, etc.)';
COMMENT ON COLUMN company_settings.data_abertura IS 'Data de abertura/início das atividades';
COMMENT ON COLUMN company_settings.porte IS 'Porte da empresa (MEI, ME, EPP, etc.)';
