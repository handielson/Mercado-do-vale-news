-- ============================================
-- MIGRATION: Adicionar colunas brand e model
-- ============================================
-- Data: 2026-02-01
-- Descrição: Adiciona colunas brand e model como TEXT
--            e migra dados de specs para as novas colunas

-- Adicionar colunas brand e model
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS model TEXT,
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Migrar dados existentes de specs para as novas colunas
UPDATE products 
SET 
    brand = specs->>'brand',
    model = specs->>'model'
WHERE specs IS NOT NULL;

-- Adicionar comentários
COMMENT ON COLUMN products.brand IS 'Nome da marca do produto (ex: Apple, Samsung)';
COMMENT ON COLUMN products.model IS 'Nome do modelo do produto (ex: iPhone 14 Pro Max, Galaxy S23)';
COMMENT ON COLUMN products.images IS 'Array de URLs das imagens do produto';

-- Criar índices para melhor performance em buscas
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_model ON products(model);

-- Verificar migração
SELECT 
    name,
    brand,
    model,
    specs->>'brand' as brand_specs,
    specs->>'model' as model_specs
FROM products
LIMIT 10;
