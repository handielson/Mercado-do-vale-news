-- LOCAL ONLY: apply after 047, before enabling production.
-- Raw material is distinct from sellable product stock.
CREATE TABLE IF NOT EXISTS print3d_filament_stock (
  filament_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  name_snapshot VARCHAR(191) NOT NULL,
  color_snapshot VARCHAR(120) NOT NULL,
  quantity_grams DECIMAL(12,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_print3d_filament_stock_nonnegative CHECK (quantity_grams >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS print3d_filament_movements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  filament_id VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  movement_key CHAR(36) NOT NULL,
  production_event_id CHAR(36) NULL,
  quantity_delta_grams DECIMAL(12,3) NOT NULL,
  reason ENUM('receipt','production') NOT NULL,
  actor_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_print3d_filament_movement_key (movement_key),
  UNIQUE KEY uq_print3d_filament_production_event (filament_id,production_event_id),
  KEY idx_print3d_filament_movement_time (filament_id,created_at),
  CONSTRAINT fk_print3d_filament_movement_stock FOREIGN KEY (filament_id)
    REFERENCES print3d_filament_stock(filament_id),
  CONSTRAINT fk_print3d_filament_movement_event FOREIGN KEY (production_event_id)
    REFERENCES print3d_production_events(id),
  CONSTRAINT chk_print3d_filament_movement_nonzero CHECK (quantity_delta_grams <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
