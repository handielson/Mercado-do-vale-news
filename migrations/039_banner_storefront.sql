-- Aplicar antes de publicar a versão com banners por loja.
-- Banners existentes continuam pertencendo ao Mercado do Vale.
ALTER TABLE banners
  ADD COLUMN storefront VARCHAR(32) NOT NULL DEFAULT 'mercado_do_vale',
  ADD INDEX idx_banners_storefront_order (storefront, display_order);
