-- Adiciona product_specs ao sale_items para armazenar dados do produto
-- no momento da venda (IMEI, modelo, cor, etc.) sem depender do produto existir no catálogo.

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS product_specs  JSONB,
  ADD COLUMN IF NOT EXISTS product_brand  TEXT,
  ADD COLUMN IF NOT EXISTS product_model  TEXT;

COMMENT ON COLUMN sale_items.product_specs  IS 'Snapshot das specs do produto (imei1, imei2, serial, color, ram, storage)';
COMMENT ON COLUMN sale_items.product_brand  IS 'Marca do produto no momento da venda';
COMMENT ON COLUMN sale_items.product_model  IS 'Modelo do produto no momento da venda';
