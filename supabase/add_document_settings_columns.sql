-- Script para adicionar campos de configuração de documentos
-- Execute este script no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Adicionar colunas faltantes na tabela company_settings (se não existirem)
DO $$ 
BEGIN
    -- Adicionar warranty_terms se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'warranty_terms'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN warranty_terms TEXT;
        
        COMMENT ON COLUMN company_settings.warranty_terms IS 
        'Termos de garantia exibidos no recibo (parte integrante do documento)';
    END IF;

    -- Adicionar footer_text se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'footer_text'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN footer_text TEXT;
        
        COMMENT ON COLUMN company_settings.footer_text IS 
        'Texto personalizado exibido no rodapé do recibo';
    END IF;

    -- Adicionar header_text se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'header_text'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN header_text TEXT;
        
        COMMENT ON COLUMN company_settings.header_text IS 
        'Texto personalizado exibido no cabeçalho do recibo';
    END IF;

    -- Adicionar receipt_logo_url se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'receipt_logo_url'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN receipt_logo_url TEXT;
        
        COMMENT ON COLUMN company_settings.receipt_logo_url IS 
        'URL do logo da empresa para exibição no recibo';
    END IF;

    -- Adicionar receipt_width se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'receipt_width'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN receipt_width VARCHAR(10) DEFAULT '80mm';
        
        COMMENT ON COLUMN company_settings.receipt_width IS 
        'Largura do papel da impressora térmica (58mm ou 80mm)';
    END IF;

    -- Adicionar show_company_info se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'show_company_info'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN show_company_info BOOLEAN DEFAULT true;
    END IF;

    -- Adicionar show_order_number se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'show_order_number'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN show_order_number BOOLEAN DEFAULT true;
    END IF;

    -- Adicionar show_timestamp se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'show_timestamp'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN show_timestamp BOOLEAN DEFAULT true;
    END IF;

    -- Adicionar show_seller_info se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_settings' 
        AND column_name = 'show_seller_info'
    ) THEN
        ALTER TABLE company_settings 
        ADD COLUMN show_seller_info BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'company_settings'
ORDER BY ordinal_position;
