-- Apply explicitly during the authorized release, before the API. No backfill of sales.
-- Baseline is initialized lazily from physical units at the first new controlled sale.
CREATE TABLE IF NOT EXISTS smartphone_inventory_cost_state (
  model_id VARCHAR(64) NOT NULL PRIMARY KEY,
  state JSON NOT NULL,
  initialized_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS smartphone_inventory_cost_events (
  model_id VARCHAR(64) NOT NULL,
  event_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (model_id,event_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS smartphone_sale_cost_basis (
  sale_id VARCHAR(64) NOT NULL,
  unit_id VARCHAR(64) NOT NULL,
  configuration_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  unit_cost INT NULL,
  purchase_cost INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (sale_id,unit_id)
) ENGINE=InnoDB;
