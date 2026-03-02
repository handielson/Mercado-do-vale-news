-- ============================================
-- MIGRATION: Custom Fields System
-- ============================================
-- Data: 2026-02-01
-- Descrição: Cria sistema de campos customizados no banco de dados
--            Migra campos de config/product-fields.ts para Supabase

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PARTE 1: Criar tabela custom_fields
-- ============================================

CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Field Definition
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('basic', 'spec', 'price', 'fiscal', 'logistics')),
    field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'select', 'checkbox', 'textarea')),
    
    -- Optional Configuration
    options JSONB DEFAULT '[]'::jsonb, -- For select fields: ["Option 1", "Option 2"]
    validation JSONB DEFAULT '{}'::jsonb, -- For validation rules: {"min": 0, "max": 100}
    placeholder TEXT, -- Placeholder text for input
    help_text TEXT, -- Help text shown below field
    
    -- Metadata
    is_system BOOLEAN DEFAULT false, -- System fields cannot be deleted
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(company_id, key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_fields_company ON custom_fields(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_category ON custom_fields(category);
CREATE INDEX IF NOT EXISTS idx_custom_fields_order ON custom_fields(display_order);

-- Add RLS (Row Level Security) policies
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS custom_fields_select_policy ON custom_fields;
DROP POLICY IF EXISTS custom_fields_insert_policy ON custom_fields;
DROP POLICY IF EXISTS custom_fields_update_policy ON custom_fields;
DROP POLICY IF EXISTS custom_fields_delete_policy ON custom_fields;

-- Policy: Authenticated users can see all fields
CREATE POLICY custom_fields_select_policy ON custom_fields
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can insert fields
CREATE POLICY custom_fields_insert_policy ON custom_fields
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can update non-system fields
CREATE POLICY custom_fields_update_policy ON custom_fields
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can delete non-system fields only
CREATE POLICY custom_fields_delete_policy ON custom_fields
    FOR DELETE
    USING (auth.uid() IS NOT NULL AND is_system = false);

-- Add comments
COMMENT ON TABLE custom_fields IS 'Stores custom field definitions for products';
COMMENT ON COLUMN custom_fields.key IS 'Unique field key (e.g., "display", "battery_mah")';
COMMENT ON COLUMN custom_fields.label IS 'Human-readable label (e.g., "Display (pol)", "Bateria (mAh)")';
COMMENT ON COLUMN custom_fields.category IS 'Field category: basic, spec, price, fiscal, logistics';
COMMENT ON COLUMN custom_fields.field_type IS 'Input type: text, number, select, checkbox, textarea';
COMMENT ON COLUMN custom_fields.is_system IS 'System fields cannot be deleted by users';

-- ============================================
-- PARTE 2: Popular com campos do sistema
-- ============================================

DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Pegar a primeira company
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma company encontrada! Crie uma company primeiro.';
    END IF;
    
    RAISE NOTICE 'Populando campos customizados para company: %', v_company_id;
    
    -- Basic Fields
    INSERT INTO custom_fields (company_id, key, label, category, field_type, is_system, display_order) VALUES
    (v_company_id, 'category_id', 'Categoria', 'basic', 'select', true, 1),
    (v_company_id, 'brand', 'Marca', 'basic', 'text', true, 2),
    (v_company_id, 'model', 'Modelo', 'basic', 'text', true, 3),
    (v_company_id, 'name', 'Nome do Produto', 'basic', 'text', true, 4),
    (v_company_id, 'sku', 'SKU', 'basic', 'text', true, 5),
    (v_company_id, 'description', 'Descrição', 'basic', 'textarea', true, 6),
    (v_company_id, 'images', 'Imagens', 'basic', 'text', true, 7);
    
    -- Specification Fields
    INSERT INTO custom_fields (company_id, key, label, category, field_type, is_system, display_order, placeholder) VALUES
    (v_company_id, 'imei1', 'IMEI 1', 'spec', 'text', true, 8, '15 dígitos'),
    (v_company_id, 'imei2', 'IMEI 2', 'spec', 'text', true, 9, '15 dígitos'),
    (v_company_id, 'serial', 'Serial', 'spec', 'text', true, 10, 'Número de série'),
    (v_company_id, 'color', 'Cor', 'spec', 'text', true, 11, 'Ex: Preto, Azul'),
    (v_company_id, 'storage', 'Armazenamento', 'spec', 'text', true, 12, 'Ex: 128GB, 256GB'),
    (v_company_id, 'ram', 'RAM', 'spec', 'text', true, 13, 'Ex: 4GB, 8GB'),
    (v_company_id, 'version', 'Versão', 'spec', 'text', true, 14, 'Versão do produto'),
    (v_company_id, 'battery_health', 'Saúde da Bateria', 'spec', 'number', true, 15, '0-100%'),
    (v_company_id, 'battery_mah', 'Bateria (mAh)', 'spec', 'number', true, 16, 'Ex: 5000'),
    (v_company_id, 'display', 'Display (pol)', 'spec', 'number', true, 17, 'Ex: 6.7');
    
    -- Price Fields
    INSERT INTO custom_fields (company_id, key, label, category, field_type, is_system, display_order) VALUES
    (v_company_id, 'price_cost', 'Preço de Custo', 'price', 'number', true, 18),
    (v_company_id, 'price_retail', 'Preço Varejo', 'price', 'number', true, 19),
    (v_company_id, 'price_reseller', 'Preço Revenda', 'price', 'number', true, 20),
    (v_company_id, 'price_wholesale', 'Preço Atacado', 'price', 'number', true, 21);
    
    RAISE NOTICE '✅ 21 campos customizados criados com sucesso!';
    
END $$;

-- ============================================
-- VERIFICAÇÃO: Listar campos criados
-- ============================================

SELECT 
    key,
    label,
    category,
    field_type,
    is_system,
    display_order
FROM custom_fields
ORDER BY category, display_order;
