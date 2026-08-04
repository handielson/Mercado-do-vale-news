CREATE TABLE IF NOT EXISTS meta_marketing_connections (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  status ENUM('disconnected', 'connected', 'expired', 'error') NOT NULL DEFAULT 'disconnected',
  graph_api_version VARCHAR(24) NOT NULL,
  token_ciphertext TEXT NULL,
  token_iv VARCHAR(64) NULL,
  token_auth_tag VARCHAR(64) NULL,
  token_expires_at DATETIME NULL,
  granted_scopes JSON NULL,
  available_ad_accounts JSON NULL,
  available_pages JSON NULL,
  selected_ad_account_id VARCHAR(80) NULL,
  selected_page_id VARCHAR(80) NULL,
  selected_instagram_account_id VARCHAR(80) NULL,
  instagram_username VARCHAR(255) NULL,
  last_audit JSON NULL,
  last_audit_at DATETIME NULL,
  last_error TEXT NULL,
  connected_by VARCHAR(80) NULL,
  connected_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meta_marketing_oauth_states (
  state_hash CHAR(64) NOT NULL PRIMARY KEY,
  requested_by VARCHAR(80) NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_meta_oauth_state_expiry (expires_at, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
