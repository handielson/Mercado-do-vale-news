-- LOCAL ONLY. Apply after 041/042 with backup and explicit authorization.
CREATE TABLE IF NOT EXISTS print3d_payment_charges (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  stage ENUM('initial','balance') NOT NULL,
  idempotency_key CHAR(36) NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  provider_payment_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'creating',
  payer_email VARCHAR(254) NOT NULL,
  pix_code TEXT NULL,
  pix_qr_base64 MEDIUMTEXT NULL,
  expires_at VARCHAR(40) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_print3d_charge_request (order_id,idempotency_key),
  UNIQUE KEY uq_print3d_charge_payment (provider_payment_id),
  KEY idx_print3d_charge_stage (order_id,stage,created_at),
  CONSTRAINT fk_print3d_charge_plan FOREIGN KEY (order_id) REFERENCES print3d_order_plans(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Rollback: disable payment/checkout flags. Preserve charges and receipts.
