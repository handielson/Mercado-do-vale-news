-- Apply before deploying the smartphone price group API. No commercial backfill.
-- Rollback: roll back API first; retain this table to preserve confirmed prices.
CREATE TABLE IF NOT EXISTS smartphone_price_groups (
  id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  model_id VARCHAR(64) NOT NULL,
  company_id VARCHAR(64) NULL,
  configuration JSON NOT NULL,
  price_retail INT NOT NULL,
  price_reseller INT NOT NULL,
  price_wholesale INT NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_smartphone_prices_model (model_id)
) ENGINE=InnoDB;
