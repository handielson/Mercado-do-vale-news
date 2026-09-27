-- LOCAL ONLY: apply after 047 and 048, before enabling production with supplies.
-- Quantity is expressed in the unit selected in the cost catalog and frozen in
-- each recipe revision. It never alters sellable product stock.
CREATE TABLE IF NOT EXISTS print3d_supply_stock (
  supply_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  name_snapshot VARCHAR(191) NOT NULL,
  unit_snapshot VARCHAR(40) NOT NULL,
  quantity_units DECIMAL(16,6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_print3d_supply_stock_nonnegative CHECK (quantity_units >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS print3d_supply_movements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  supply_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  movement_key CHAR(36) NOT NULL,
  production_event_id CHAR(36) NULL,
  quantity_delta_units DECIMAL(16,6) NOT NULL,
  reason ENUM('receipt','production') NOT NULL,
  actor_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_print3d_supply_movement_key (movement_key),
  UNIQUE KEY uq_print3d_supply_production_event (supply_id,production_event_id),
  KEY idx_print3d_supply_movement_time (supply_id,created_at),
  CONSTRAINT fk_print3d_supply_movement_stock FOREIGN KEY (supply_id)
    REFERENCES print3d_supply_stock(supply_id),
  CONSTRAINT fk_print3d_supply_movement_event FOREIGN KEY (production_event_id)
    REFERENCES print3d_production_events(id),
  CONSTRAINT chk_print3d_supply_movement_nonzero CHECK (quantity_delta_units <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
