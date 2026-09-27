-- Aplicar com backup antes de publicar o cadastro 3D.
-- O estoque físico continua exclusivamente em products.stock_quantity / product_stock_locations.
-- Estes campos guardam a intenção comercial; não habilitam o checkout sob encomenda.
ALTER TABLE products
  ADD COLUMN is_print3d TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN print3d_preorder_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN print3d_preorder_limit INT UNSIGNED NULL,
  ADD INDEX idx_products_print3d_catalog (is_print3d, status);

-- O prazo por SKU já existe em products.production_days; não duplicar esse valor.
-- Reversão operacional: ocultar a função no aplicativo, sem excluir dados de produto.
