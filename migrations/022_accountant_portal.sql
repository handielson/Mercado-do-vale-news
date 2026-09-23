CREATE TABLE IF NOT EXISTS company_accountant_access (
  id CHAR(36) NOT NULL PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  customer_id VARCHAR(80) NOT NULL,
  can_edit_tax_validation TINYINT(1) NOT NULL DEFAULT 1,
  can_view_revenue TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(80) NOT NULL,
  revoked_by VARCHAR(80) NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_company_accountant_profile_customer (profile_id, customer_id),
  KEY idx_company_accountant_customer_active (customer_id, is_active),
  CONSTRAINT fk_company_accountant_profile FOREIGN KEY (profile_id) REFERENCES company_fiscal_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_fiscal_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  external_sale_id VARCHAR(255) NOT NULL,
  model VARCHAR(10) NOT NULL,
  status VARCHAR(24) NOT NULL,
  access_key CHAR(44) NULL,
  document_number VARCHAR(30) NULL,
  series VARCHAR(10) NULL,
  issued_at DATETIME NULL,
  total_cents BIGINT NOT NULL DEFAULT 0,
  source VARCHAR(30) NOT NULL,
  source_reference VARCHAR(255) NULL,
  created_by VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_company_fiscal_access_key (access_key),
  UNIQUE KEY uniq_company_fiscal_source_document (profile_id, source, source_reference, model),
  KEY idx_company_fiscal_document_sale (profile_id, channel, external_sale_id, status),
  KEY idx_company_fiscal_document_issued (profile_id, issued_at),
  CONSTRAINT fk_company_fiscal_document_profile FOREIGN KEY (profile_id) REFERENCES company_fiscal_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_fiscal_sale_reconciliations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  external_sale_id VARCHAR(255) NOT NULL,
  classification VARCHAR(24) NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  confirmed_by VARCHAR(80) NULL,
  confirmed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_company_fiscal_sale_reconciliation (profile_id, channel, external_sale_id),
  KEY idx_company_fiscal_reconciliation_class (profile_id, classification, updated_at),
  CONSTRAINT fk_company_fiscal_reconciliation_profile FOREIGN KEY (profile_id) REFERENCES company_fiscal_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
