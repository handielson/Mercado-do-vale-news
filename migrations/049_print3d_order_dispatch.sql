-- LOCAL ONLY: apply after 042 and 046, before enabling 3D dispatch.
-- One immutable dispatch per order. The stock and production transitions are
-- committed in the same transaction as this row.
CREATE TABLE IF NOT EXISTS print3d_order_dispatches (
  order_id CHAR(36) NOT NULL PRIMARY KEY,
  tracking_code VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  actor_id VARCHAR(191) NOT NULL,
  ready_quantity INT UNSIGNED NOT NULL,
  produced_quantity INT UNSIGNED NOT NULL,
  dispatched_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_print3d_dispatch_plan FOREIGN KEY (order_id) REFERENCES print3d_order_plans(order_id),
  CONSTRAINT chk_print3d_dispatch_quantity CHECK (ready_quantity + produced_quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
