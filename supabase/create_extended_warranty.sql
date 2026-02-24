-- Migração para Adicionar Campos de Garantia Estendida Dinâmica

-- 1. Alterar a tabela `company_settings`
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS extended_warranty_options JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS extended_warranty_terms_text TEXT;

-- Fornecer um valor padrão de exemplo (Opcional, mas útil para testes)
UPDATE company_settings
SET extended_warranty_options = '[
    {"months": 3, "percentage": 8, "active": true},
    {"months": 6, "percentage": 12, "active": true},
    {"months": 12, "percentage": 15, "active": true}
]'::jsonb,
extended_warranty_terms_text = '<h2>Termos de Garantia Estendida</h2><p>A garantia estendida cobre defeitos de fabricação após o término da garantia legal e padrão.</p>'
WHERE id IS NOT NULL;

-- 2. Alterar a tabela `sale_items`
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS warranty_months INTEGER,
ADD COLUMN IF NOT EXISTS warranty_price BIGINT;

-- Omentários para clareza
COMMENT ON COLUMN company_settings.extended_warranty_options IS 'Configurações de Faixas de Garantia: [{months: 3, percentage: 5, active: true}]';
COMMENT ON COLUMN company_settings.extended_warranty_terms_text IS 'Texto descritivo do regulamento da Garantia Estendida para a página pública';
COMMENT ON COLUMN sale_items.warranty_months IS 'Quantos meses de garantia estendida foram adquiridos para este item';
COMMENT ON COLUMN sale_items.warranty_price IS 'Valor cobrado pela garantia estendida (em centavos)';
