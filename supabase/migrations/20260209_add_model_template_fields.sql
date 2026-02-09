-- Migration: Add template fields to models table
-- Data: 2026-02-09
-- Descrição: Adiciona campos para armazenar valores padrão de templates de modelos

-- ============================================
-- 1. Adicionar campos de template
-- ============================================

-- Campo JSON para armazenar valores padrão dinâmicos
ALTER TABLE models ADD COLUMN IF NOT EXISTS template_values JSONB DEFAULT '{}'::jsonb;

-- Categoria padrão para produtos deste modelo
ALTER TABLE models ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);

-- Descrição padrão do modelo
ALTER TABLE models ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================
-- 2. Comentários
-- ============================================

COMMENT ON COLUMN models.template_values IS 'Valores padrão dos campos (JSON) - ex: {"storage": "128GB", "ram": "8GB", "price_retail": 2500}';
COMMENT ON COLUMN models.category_id IS 'Categoria padrão para produtos deste modelo';
COMMENT ON COLUMN models.description IS 'Descrição padrão do modelo';

-- ============================================
-- 3. Índices
-- ============================================

CREATE INDEX IF NOT EXISTS idx_models_category ON models(category_id);
CREATE INDEX IF NOT EXISTS idx_models_template_values ON models USING GIN (template_values);

-- ============================================
-- Exemplo de Uso
-- ============================================

-- Atualizar modelo com template:
-- UPDATE models 
-- SET 
--     category_id = 'uuid-da-categoria',
--     description = 'Smartphone Apple iPhone 13 com tela de 6.1 polegadas',
--     template_values = '{
--         "storage": "128GB",
--         "ram": "4GB",
--         "battery_mah": "3240",
--         "display": "6.1",
--         "price_cost": 2000,
--         "price_retail": 2500,
--         "price_reseller": 2300,
--         "price_wholesale": 2100
--     }'::jsonb
-- WHERE id = 'uuid-do-modelo';
