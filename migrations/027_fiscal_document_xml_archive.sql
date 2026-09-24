-- Only original XML is persisted. PDFs are generated in memory on demand.
CREATE TABLE IF NOT EXISTS company_fiscal_document_xmls (
  document_id CHAR(36) NOT NULL PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  authorized_xml MEDIUMTEXT NOT NULL,
  xml_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  archived_by VARCHAR(100) NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fiscal_xml_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
