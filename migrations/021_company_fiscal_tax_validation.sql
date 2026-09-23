CREATE TABLE IF NOT EXISTS company_fiscal_tax_validations (
  profile_id CHAR(36) NOT NULL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  reviewer_name VARCHAR(255) NOT NULL DEFAULT '',
  reviewer_registration VARCHAR(100) NOT NULL DEFAULT '',
  reviewed_at DATE NULL,
  notes VARCHAR(2000) NOT NULL DEFAULT '',
  rules_json JSON NOT NULL,
  bling_reference_json JSON NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aprovado aqui significa validação contábil registrada. Esta tabela não ativa
-- cálculo, emissão, numeração ou transmissão fiscal automaticamente.
