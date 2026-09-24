-- Preparação da emissão própria. Aplicar somente em release coordenado, após backup.
-- Não habilita transmissão nem altera venda, estoque ou documentos importados do Bling.
CREATE TABLE IF NOT EXISTS company_fiscal_nfce_sequences (
  profile_id CHAR(36) NOT NULL,
  environment ENUM('homologation','production') NOT NULL,
  series SMALLINT UNSIGNED NOT NULL,
  next_number INT UNSIGNED NOT NULL,
  bling_last_number INT UNSIGNED NOT NULL,
  checked_by VARCHAR(80) NOT NULL,
  checked_at DATETIME NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id,environment,series),
  CONSTRAINT fk_nfce_sequence_profile FOREIGN KEY (profile_id) REFERENCES company_fiscal_profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_fiscal_nfce_issuances (
  id CHAR(36) NOT NULL PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  sale_id VARCHAR(80) NOT NULL,
  environment ENUM('homologation','production') NOT NULL,
  series SMALLINT UNSIGNED NOT NULL,
  document_number INT UNSIGNED NOT NULL,
  status ENUM('reserved','prepared','sending','uncertain','rejected','denied','authorized','cancelled') NOT NULL DEFAULT 'reserved',
  access_key CHAR(44) CHARACTER SET ascii COLLATE ascii_bin NULL,
  signed_xml MEDIUMTEXT NULL,
  authorized_xml MEDIUMTEXT NULL,
  sefaz_response_xml MEDIUMTEXT NULL,
  authorized_xml_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  authorization_protocol VARCHAR(30) NULL,
  authorized_at DATETIME NULL,
  last_error VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_nfce_sale_environment (profile_id,sale_id,environment),
  UNIQUE KEY uq_nfce_number (profile_id,environment,series,document_number),
  UNIQUE KEY uq_nfce_access_key (access_key),
  KEY idx_nfce_state (profile_id,status,updated_at),
  CONSTRAINT fk_nfce_issuance_profile FOREIGN KEY (profile_id) REFERENCES company_fiscal_profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rollback operacional: manter os números e XMLs já gravados; nunca apagar nem reutilizar reservas.
