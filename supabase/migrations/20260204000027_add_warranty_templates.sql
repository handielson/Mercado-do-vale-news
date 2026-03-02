-- =====================================================
-- MIGRATION: Add Warranty Templates System
-- Date: 2026-02-04
-- Description: Creates warranty_templates table for custom warranty terms
-- =====================================================

-- Create warranty_templates table
CREATE TABLE IF NOT EXISTS warranty_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Identification
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Duration
    duration_days INTEGER NOT NULL,
    
    -- Terms and Conditions (supports variables: {dias}, {produto}, {marca}, {data_compra})
    terms TEXT NOT NULL,
    
    -- Metadata
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT warranty_templates_company_name_unique UNIQUE(company_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warranty_templates_company ON warranty_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_warranty_templates_active ON warranty_templates(active);

-- Add comments
COMMENT ON TABLE warranty_templates IS 'Reusable warranty templates for custom warranties';
COMMENT ON COLUMN warranty_templates.name IS 'Template name (e.g., "Extended Warranty 1 Year")';
COMMENT ON COLUMN warranty_templates.duration_days IS 'Warranty duration in days';
COMMENT ON COLUMN warranty_templates.terms IS 'Warranty terms text with variable support: {dias}, {produto}, {marca}, {data_compra}';
COMMENT ON COLUMN warranty_templates.active IS 'Whether this template is active and can be selected';

-- =====================================================
-- Update products table
-- =====================================================

-- Remove old warranty_custom_text column (if exists)
ALTER TABLE products DROP COLUMN IF EXISTS warranty_custom_text;

-- Add warranty_template_id column
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_template_id UUID REFERENCES warranty_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN products.warranty_template_id IS 'Warranty template reference (used when warranty_type = custom)';

-- =====================================================
-- Insert default templates
-- =====================================================

-- Get the company ID (assuming 'mercado-do-vale' slug)
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT id INTO v_company_id FROM companies WHERE slug = 'mercado-do-vale' LIMIT 1;
    
    IF v_company_id IS NOT NULL THEN
        -- Template 1: Basic Warranty
        INSERT INTO warranty_templates (company_id, name, description, duration_days, terms, active)
        VALUES (
            v_company_id,
            'Garantia Básica 90 dias',
            'Garantia padrão de 90 dias conforme CDC',
            90,
            'Este produto possui garantia de {dias} dias contra defeitos de fabricação, conforme previsto no Código de Defesa do Consumidor. Produto: {produto}, Marca: {marca}, Data da compra: {data_compra}.',
            true
        )
        ON CONFLICT (company_id, name) DO NOTHING;
        
        -- Template 2: Extended Warranty 1 Year
        INSERT INTO warranty_templates (company_id, name, description, duration_days, terms, active)
        VALUES (
            v_company_id,
            'Garantia Estendida 1 Ano',
            'Garantia estendida de 365 dias',
            365,
            'GARANTIA ESTENDIDA DE {dias} DIAS

O produto {produto} da marca {marca}, adquirido em {data_compra}, possui garantia estendida de 1 ano contra defeitos de fabricação, peças e mão de obra.

Condições:
- Válido apenas para defeitos de fabricação
- Não cobre danos causados por mau uso
- Assistência técnica autorizada',
            true
        )
        ON CONFLICT (company_id, name) DO NOTHING;
        
        -- Template 3: No Warranty
        INSERT INTO warranty_templates (company_id, name, description, duration_days, terms, active)
        VALUES (
            v_company_id,
            'Produto Sem Garantia',
            'Produto vendido sem garantia adicional',
            0,
            'Este produto ({produto}) é vendido no estado em que se encontra, sem garantia adicional além da prevista em lei.',
            true
        )
        ON CONFLICT (company_id, name) DO NOTHING;
    END IF;
END $$;
