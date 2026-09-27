-- LOCAL ONLY: apply after 040 and 041, before enabling production in any environment.
-- A completed 3D piece is allocated to the originating order. It does not enter
-- product_stock_locations and therefore cannot be offered to another customer.
CREATE TABLE IF NOT EXISTS print3d_production_outputs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  production_event_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  order_item_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  status ENUM('reserved_for_order','dispatched','cancelled') NOT NULL DEFAULT 'reserved_for_order',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_print3d_output_event (production_event_id),
  KEY idx_print3d_output_job_status (job_id,status),
  KEY idx_print3d_output_order_status (order_id,status),
  CONSTRAINT fk_print3d_output_job FOREIGN KEY (job_id) REFERENCES print3d_production_jobs(id),
  CONSTRAINT fk_print3d_output_event FOREIGN KEY (production_event_id) REFERENCES print3d_production_events(id),
  CONSTRAINT chk_print3d_output_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- No trigger updates central stock. Dispatch will be a separate, paid-and-shipped
-- workflow; it must change this allocation rather than make the pieces sellable.
