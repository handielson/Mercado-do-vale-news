-- =====================================================
-- SCRIPT SIMPLIFICADO: Warranty Templates
-- Execute no Supabase Dashboard (SQL Editor)
-- =====================================================

-- 1. Criar tabela warranty_templates
CREATE TABLE IF NOT EXISTS warranty_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL,
    terms TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT warranty_templates_company_name_unique UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_warranty_templates_company ON warranty_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_warranty_templates_active ON warranty_templates(active);

-- 2. Atualizar tabela products
ALTER TABLE products DROP COLUMN IF EXISTS warranty_custom_text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_template_id UUID REFERENCES warranty_templates(id) ON DELETE SET NULL;

-- 3. Inserir templates padrão
INSERT INTO warranty_templates (company_id, name, description, duration_days, terms, active)
SELECT 
    c.id,
    'Garantia Básica 90 dias',
    'Garantia padrão de 90 dias conforme CDC',
    90,
    'Este produto possui garantia de {dias} dias contra defeitos de fabricação, conforme previsto no Código de Defesa do Consumidor. Produto: {produto}, Marca: {marca}, Data da compra: {data_compra}.',
    true
FROM companies c
WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO warranty_templates (company_id, name, description, duration_days, terms, active)
SELECT 
    c.id,
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
FROM companies c
WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO warranty_templates (company_id, name, description, duration_days, terms, active)
SELECT 
    c.id,
    'Produto Sem Garantia',
    'Produto vendido sem garantia adicional',
    0,
    'Este produto ({produto}) é vendido no estado em que se encontra, sem garantia adicional além da prevista em lei.',
    true
FROM companies c
WHERE c.slug = 'mercado-do-vale'
ON CONFLICT (company_id, name) DO NOTHING;
