-- Script para adicionar Sistema de Garantias
-- Execute este script no SQL Editor do Supabase Dashboard

-- Adicionar warranty_days às marcas
ALTER TABLE brands ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 90;
COMMENT ON COLUMN brands.warranty_days IS 'Período de garantia padrão em dias para produtos desta marca';

-- Adicionar warranty_days às categorias
ALTER TABLE categories ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 90;
COMMENT ON COLUMN categories.warranty_days IS 'Período de garantia padrão em dias para produtos desta categoria';

-- Adicionar campos de garantia aos produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_type VARCHAR(20) DEFAULT 'brand';
COMMENT ON COLUMN products.warranty_type IS 'Tipo de garantia: brand, category ou custom';

ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty_custom_text TEXT;
COMMENT ON COLUMN products.warranty_custom_text IS 'Texto personalizado de garantia (usado quando warranty_type = custom)';

-- Adicionar constraint para validar warranty_type
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_warranty_type_check'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_warranty_type_check 
        CHECK (warranty_type IN ('brand', 'category', 'custom'));
    END IF;
END $$;

-- Verificar se as colunas foram criadas
SELECT 'brands' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'brands' AND column_name = 'warranty_days'
UNION ALL
SELECT 'categories' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'categories' AND column_name = 'warranty_days'
UNION ALL
SELECT 'products' as table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name IN ('warranty_type', 'warranty_custom_text')
ORDER BY table_name, column_name;
