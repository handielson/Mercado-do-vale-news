-- Perfis fiscais por produto (pedido da contabilidade em 01/11/2026: tributacao por produto, com blocos NFC-e 65 e NF-e 55)
-- Esta migration so cria cadastro. Nao ativa calculo, emissao, numeracao ou transmissao fiscal.
CREATE TABLE IF NOT EXISTS company_fiscal_tax_profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_profile_id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  data_json JSON NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fiscal_tax_profile_name (company_profile_id, name),
  KEY idx_fiscal_tax_profile_company (company_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_fiscal_settings (
  company_profile_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  tax_profile_id CHAR(36) NULL,
  overrides_json JSON NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_by VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_profile_id, product_id),
  KEY idx_product_fiscal_tax_profile (tax_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
