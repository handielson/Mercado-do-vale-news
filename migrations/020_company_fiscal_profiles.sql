-- MySQL. Apply explicitly during release, after backup; never on application startup.
-- Additional companies are fiscal registrations, not global tenant switches.
CREATE TABLE IF NOT EXISTS company_fiscal_profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  settings_id CHAR(36) NULL,
  cnpj VARCHAR(14) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL DEFAULT '',
  state_registration VARCHAR(30) NOT NULL DEFAULT '',
  state_registration_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  municipal_registration VARCHAR(30) NOT NULL DEFAULT '',
  suframa_registration VARCHAR(30) NOT NULL DEFAULT '',
  cnae VARCHAR(255) NOT NULL DEFAULT '',
  cnae_activities JSON NULL,
  company_size VARCHAR(80) NOT NULL DEFAULT '',
  main_activity VARCHAR(255) NOT NULL DEFAULT '',
  business_segments VARCHAR(100) NOT NULL DEFAULT '',
  annual_revenue_band VARCHAR(80) NOT NULL DEFAULT '',
  employees_band VARCHAR(80) NOT NULL DEFAULT '',
  contact_person VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(30) NOT NULL DEFAULT '',
  mobile_phone VARCHAR(30) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  billing_email VARCHAR(255) NOT NULL DEFAULT '',
  website VARCHAR(255) NOT NULL DEFAULT '',
  substitute_state_registrations JSON NULL,
  uf CHAR(2) NOT NULL DEFAULT '',
  municipality_code VARCHAR(7) NOT NULL DEFAULT '',
  address_zip_code VARCHAR(8) NOT NULL DEFAULT '',
  address_street VARCHAR(255) NOT NULL DEFAULT '',
  address_number VARCHAR(30) NOT NULL DEFAULT '',
  address_complement VARCHAR(255) NOT NULL DEFAULT '',
  address_neighborhood VARCHAR(255) NOT NULL DEFAULT '',
  address_city VARCHAR(255) NOT NULL DEFAULT '',
  regime VARCHAR(32) NOT NULL DEFAULT 'nao_definido',
  crt CHAR(1) NULL,
  effective_from DATE NULL,
  notes VARCHAR(1000) NOT NULL DEFAULT '',
  lookup_json JSON NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fiscal_cnpj (cnpj),
  UNIQUE KEY uq_fiscal_settings (settings_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_fiscal_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  actor VARCHAR(80) NOT NULL,
  event VARCHAR(30) NOT NULL,
  details JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_fiscal_events (profile_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Metadata only. The encrypted PFX vault is outside MySQL and outside the web root.
-- Never store the PFX bytes, its password or the vault master key in this table.
CREATE TABLE IF NOT EXISTS company_certificate_settings (
  profile_id CHAR(36) NOT NULL PRIMARY KEY,
  valid_until DATE NULL,
  alert_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  certificate_type VARCHAR(20) NOT NULL DEFAULT 'A1_SERVER',
  verified_locally BOOLEAN NOT NULL DEFAULT FALSE,
  storage_ref VARCHAR(100) NULL,
  fingerprint_sha256 VARCHAR(95) NULL,
  subject_name VARCHAR(1000) NULL,
  issuer_name VARCHAR(1000) NULL,
  serial_number VARCHAR(100) NULL,
  installed_at DATETIME NULL,
  last_sefaz_checked_at DATETIME NULL,
  last_sefaz_environment VARCHAR(20) NULL,
  last_sefaz_status VARCHAR(10) NULL,
  last_sefaz_reason VARCHAR(255) NULL,
  updated_by VARCHAR(80) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Rollback: first disable MDV_COMPANY_FISCAL_ENABLED; preserve these tables and
-- export their data. Do not drop them after real registrations without a backup.
