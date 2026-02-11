-- Migration: Adicionar colunas description e logística à tabela models
-- Data: 2026-02-10

ALTER TABLE models 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS depth_cm DECIMAL(10,2);

COMMENT ON COLUMN models.description IS 'Descrição detalhada do modelo';
COMMENT ON COLUMN models.weight_kg IS 'Peso em quilogramas';
COMMENT ON COLUMN models.width_cm IS 'Largura em centímetros';
COMMENT ON COLUMN models.height_cm IS 'Altura em centímetros';
COMMENT ON COLUMN models.depth_cm IS 'Profundidade em centímetros';
