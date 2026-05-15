ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_type VARCHAR(32) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_parent_product_id CHAR(36) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_visibility VARCHAR(16) NULL DEFAULT 'visible';
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopee_strategy VARCHAR(32) NULL DEFAULT 'variation';
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopee_offer_status VARCHAR(32) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopee_offer_error TEXT NULL;

SET @idx_products_offer_parent_exists = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'products'
    AND index_name = 'idx_products_offer_parent'
);
SET @idx_products_offer_parent_sql = IF(
  @idx_products_offer_parent_exists = 0,
  'CREATE INDEX idx_products_offer_parent ON products (offer_parent_product_id)',
  'SELECT 1'
);
PREPARE idx_products_offer_parent_stmt FROM @idx_products_offer_parent_sql;
EXECUTE idx_products_offer_parent_stmt;
DEALLOCATE PREPARE idx_products_offer_parent_stmt;

SET @idx_products_offer_type_exists = (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'products'
    AND index_name = 'idx_products_offer_type'
);
SET @idx_products_offer_type_sql = IF(
  @idx_products_offer_type_exists = 0,
  'CREATE INDEX idx_products_offer_type ON products (offer_type)',
  'SELECT 1'
);
PREPARE idx_products_offer_type_stmt FROM @idx_products_offer_type_sql;
EXECUTE idx_products_offer_type_stmt;
DEALLOCATE PREPARE idx_products_offer_type_stmt;
