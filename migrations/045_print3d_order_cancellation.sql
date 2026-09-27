-- LOCAL ONLY. Apply after 040-044 with backup and explicit authorization.
-- Keeps cancellations, expired PIX reservations and late gateway confirmations
-- auditable without changing the immutable financial receipt ledger.
CREATE TABLE IF NOT EXISTS print3d_order_cancellation_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  event_type ENUM('cancelled','expired','late_payment') NOT NULL,
  actor_type ENUM('customer','admin','system','gateway') NOT NULL,
  actor_id VARCHAR(191) NOT NULL,
  provider_payment_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reason VARCHAR(500) NOT NULL,
  details_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_print3d_cancel_events_order (order_id,created_at),
  KEY idx_print3d_cancel_events_type (event_type,created_at),
  UNIQUE KEY uq_print3d_late_provider (event_type,provider_payment_id),
  CONSTRAINT fk_print3d_cancel_event_plan FOREIGN KEY (order_id) REFERENCES print3d_order_plans(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Rollback: disable checkout/payment runtime flags; preserve event history.
