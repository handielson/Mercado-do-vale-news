CREATE TABLE IF NOT EXISTS smartphone_photo_color_mappings (
  id CHAR(36) NOT NULL,
  company_id CHAR(36) NULL,
  source_color_key VARCHAR(160) NOT NULL,
  source_color VARCHAR(160) NOT NULL,
  color_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_photo_color_mapping_scope (company_id, source_color_key),
  INDEX idx_photo_color_mapping_color (color_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
