-- Migration: Add Shipping Fields to Products and Create Shipping Presets Table
-- Created: 2026-02-08
-- Description: Adds shipping dimensions (weight, height, width, length) to products
--              and creates a shipping_presets table for reusable dimension templates

-- Step 1: Add shipping columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS shipping_weight INTEGER, -- Peso em gramas
ADD COLUMN IF NOT EXISTS shipping_height DECIMAL(10,2), -- Altura em cm
ADD COLUMN IF NOT EXISTS shipping_width DECIMAL(10,2), -- Largura em cm
ADD COLUMN IF NOT EXISTS shipping_length DECIMAL(10,2); -- Comprimento em cm

-- Step 2: Create shipping_presets table
CREATE TABLE IF NOT EXISTS shipping_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    weight INTEGER NOT NULL, -- Peso em gramas
    height DECIMAL(10,2) NOT NULL, -- Altura em cm
    width DECIMAL(10,2) NOT NULL, -- Largura em cm
    length DECIMAL(10,2) NOT NULL, -- Comprimento em cm
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE
);

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shipping_presets_category ON shipping_presets(category_id);
CREATE INDEX IF NOT EXISTS idx_shipping_presets_company ON shipping_presets(company_id);
CREATE INDEX IF NOT EXISTS idx_shipping_presets_default ON shipping_presets(is_default) WHERE is_default = true;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN products.shipping_weight IS 'Peso do produto em gramas para cálculo de frete';
COMMENT ON COLUMN products.shipping_height IS 'Altura do produto em centímetros';
COMMENT ON COLUMN products.shipping_width IS 'Largura do produto em centímetros';
COMMENT ON COLUMN products.shipping_length IS 'Comprimento do produto em centímetros';

COMMENT ON TABLE shipping_presets IS 'Presets de dimensões de frete reutilizáveis por categoria';
COMMENT ON COLUMN shipping_presets.is_default IS 'Se true, este preset é aplicado automaticamente ao selecionar a categoria';

-- Step 5: Insert initial presets (optional - can be done via UI)
-- These are common presets for typical product categories

-- Celular Padrão
INSERT INTO shipping_presets (name, weight, height, width, length, is_default, company_id)
SELECT 
    'Celular Padrão',
    200, -- 200g
    15.0, -- 15cm
    7.0, -- 7cm
    1.0, -- 1cm
    false,
    id
FROM companies
WHERE id = (SELECT id FROM companies LIMIT 1)
ON CONFLICT DO NOTHING;

-- Tablet Padrão
INSERT INTO shipping_presets (name, weight, height, width, length, is_default, company_id)
SELECT 
    'Tablet Padrão',
    500, -- 500g
    25.0, -- 25cm
    17.0, -- 17cm
    0.8, -- 0.8cm
    false,
    id
FROM companies
WHERE id = (SELECT id FROM companies LIMIT 1)
ON CONFLICT DO NOTHING;

-- Notebook Padrão
INSERT INTO shipping_presets (name, weight, height, width, length, is_default, company_id)
SELECT 
    'Notebook Padrão',
    2000, -- 2kg
    35.0, -- 35cm
    25.0, -- 25cm
    2.0, -- 2cm
    false,
    id
FROM companies
WHERE id = (SELECT id FROM companies LIMIT 1)
ON CONFLICT DO NOTHING;

-- Acessório Pequeno
INSERT INTO shipping_presets (name, weight, height, width, length, is_default, company_id)
SELECT 
    'Acessório Pequeno',
    50, -- 50g
    10.0, -- 10cm
    10.0, -- 10cm
    3.0, -- 3cm
    false,
    id
FROM companies
WHERE id = (SELECT id FROM companies LIMIT 1)
ON CONFLICT DO NOTHING;
