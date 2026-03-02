-- Migration: Add SEO fields to products table
-- Date: 2026-02-08
-- Description: Adds SEO-related columns for product optimization (description, slug, meta_title, meta_description, keywords)

-- Add SEO columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(60),
ADD COLUMN IF NOT EXISTS meta_description VARCHAR(160),
ADD COLUMN IF NOT EXISTS keywords TEXT[];

-- Create index for slug lookups (performance optimization)
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

-- Add comments for documentation
COMMENT ON COLUMN products.description IS 'Descrição detalhada do produto (HTML/Rich Text) para SEO - Gerada por IA';
COMMENT ON COLUMN products.slug IS 'Slug amigável para URL (ex: iphone-15-pro-max-256gb-preto) - Único';
COMMENT ON COLUMN products.meta_title IS 'Meta título SEO (máx 60 caracteres) - Gerado por IA';
COMMENT ON COLUMN products.meta_description IS 'Meta descrição SEO (máx 160 caracteres) - Gerada por IA';
COMMENT ON COLUMN products.keywords IS 'Array de palavras-chave/tags para busca e SEO - Geradas por IA';
