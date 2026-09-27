-- LOCAL ONLY: prepare after 034. Apply only with an authorized migration plan.
-- Runtime creation/release also requires 041 (immutable order plan and verified receipts).
CREATE TABLE IF NOT EXISTS print3d_production_jobs (
 id CHAR(36) NOT NULL PRIMARY KEY,
 order_id CHAR(36) NOT NULL,
 order_number VARCHAR(64) NOT NULL,
 order_item_id CHAR(36) NOT NULL,
 product_id CHAR(36) NOT NULL,
 product_name VARCHAR(255) NOT NULL,
 sku VARCHAR(191) NOT NULL,
 target_quantity INT UNSIGNED NOT NULL,
 approved_quantity INT UNSIGNED NOT NULL DEFAULT 0,
 rejected_quantity INT UNSIGNED NOT NULL DEFAULT 0,
 recipe_id CHAR(36) NOT NULL,
 primary_file_id CHAR(36) NOT NULL,
 status ENUM('awaiting_payment','queued','in_progress','completed','cancelled') NOT NULL DEFAULT 'awaiting_payment',
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_print3d_production_item (order_item_id),
 KEY idx_print3d_production_order (order_id),
 KEY idx_print3d_production_status (status,created_at),
 CONSTRAINT chk_print3d_production_counts CHECK (target_quantity > 0 AND approved_quantity <= target_quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS print3d_production_events (
 id CHAR(36) NOT NULL PRIMARY KEY,
 job_id CHAR(36) NOT NULL,
 idempotency_key CHAR(36) NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 approved_quantity INT UNSIGNED NOT NULL,
 rejected_quantity INT UNSIGNED NOT NULL,
 note VARCHAR(2000) NOT NULL DEFAULT '',
 actor_id VARCHAR(191) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_print3d_production_event (job_id,idempotency_key),
 KEY idx_print3d_production_events_job (job_id,created_at),
 CONSTRAINT fk_print3d_production_event_job FOREIGN KEY (job_id) REFERENCES print3d_production_jobs(id),
 CONSTRAINT chk_print3d_production_event_counts CHECK (approved_quantity > 0 OR rejected_quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- No triggers write stock, payments, shipment or customer messages.
-- Operational rollback: disable MDV_PRINT3D_PRODUCTION_ENABLED; retain audit history.
