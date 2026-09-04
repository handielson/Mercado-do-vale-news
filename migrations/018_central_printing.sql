-- Aplicar explicitamente durante publicação aprovada. Sem DDL no startup da API.
-- Escopo desta instalação: administradores globais do Mercado do Vale.
CREATE TABLE IF NOT EXISTS central_print_devices (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  secret_hash CHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  allowed_printers JSON NOT NULL,
  inventory JSON NULL,
  last_seen_at DATETIME NULL,
  created_by VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS central_print_jobs (
  id CHAR(36) PRIMARY KEY,
  device_id CHAR(36) NOT NULL,
  printer_name VARCHAR(120) NOT NULL,
  title VARCHAR(120) NOT NULL,
  requested_by VARCHAR(191) NOT NULL,
  idempotency_key CHAR(36) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  pdf_hash CHAR(64) NOT NULL,
  pdf_data MEDIUMBLOB NULL,
  width_mm DOUBLE NOT NULL,
  height_mm DOUBLE NOT NULL,
  pages INT NOT NULL,
  settings_json JSON NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  claim_token CHAR(36) NULL,
  lease_until DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  reprint_of CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY central_print_request (requested_by, idempotency_key),
  KEY central_print_queue (device_id, status, created_at),
  CONSTRAINT central_print_device_fk FOREIGN KEY (device_id) REFERENCES central_print_devices(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS central_print_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  actor VARCHAR(191) NOT NULL,
  event VARCHAR(24) NOT NULL,
  detail VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY central_print_event_job (job_id, id),
  CONSTRAINT central_print_event_fk FOREIGN KEY (job_id) REFERENCES central_print_jobs(id)
) ENGINE=InnoDB;
