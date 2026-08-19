-- Cria as estruturas do autoatendimento do cliente na VPS/MySQL.
-- A API tambem aplica estas criacoes de forma idempotente no startup.

CREATE TABLE IF NOT EXISTS customer_type_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  customer_id VARCHAR(80) NOT NULL,
  requested_type ENUM('wholesale', 'resale') NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewed_by VARCHAR(80) NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customer_type_requests_customer (customer_id, created_at),
  KEY idx_customer_type_requests_status (status, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS benefit_redemptions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  benefit_id VARCHAR(80) NOT NULL,
  year_month CHAR(7) NOT NULL,
  redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  redeemed_by VARCHAR(80) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_benefit_redemption_month (benefit_id, year_month),
  KEY idx_benefit_redemptions_benefit (benefit_id, redeemed_at),
  KEY idx_benefit_redemptions_redeemer (redeemed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_feedbacks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_id VARCHAR(80) NOT NULL,
  type ENUM('Dúvida', 'Reclamação', 'Sugestão', 'Outro') NOT NULL,
  message TEXT NOT NULL,
  customer_name VARCHAR(255) NULL,
  customer_contact VARCHAR(255) NULL,
  status ENUM('novo', 'lido', 'respondido') NOT NULL DEFAULT 'novo',
  admin_reply TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customer_feedbacks_company (company_id, created_at),
  KEY idx_customer_feedbacks_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
