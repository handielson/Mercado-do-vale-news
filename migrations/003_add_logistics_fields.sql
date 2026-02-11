-- Migration: Adicionar Campos de Logística aos Modelos
-- Data: 2026-02-10
-- Descrição: Adiciona campos de peso e dimensões para cálculo de frete

-- Adicionar colunas de logística à tabela models
ALTER TABLE models 
ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(6,3),
ADD COLUMN IF NOT EXISTS width_cm DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS height_cm DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS depth_cm DECIMAL(6,2);

-- Comentários para documentação
COMMENT ON COLUMN models.weight_kg IS 'Peso do produto em quilogramas (ex: 0.250 = 250g)';
COMMENT ON COLUMN models.width_cm IS 'Largura do produto em centímetros';
COMMENT ON COLUMN models.height_cm IS 'Altura do produto em centímetros';
COMMENT ON COLUMN models.depth_cm IS 'Profundidade do produto em centímetros';
