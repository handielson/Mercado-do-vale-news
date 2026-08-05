CREATE TABLE IF NOT EXISTS meta_managed_ad_review_state (
  item_key VARCHAR(80) NOT NULL PRIMARY KEY,
  campaign_id VARCHAR(120) NOT NULL,
  adset_id VARCHAR(120) NOT NULL,
  ad_id VARCHAR(120) NOT NULL,
  review_state VARCHAR(32) NOT NULL,
  configured_status VARCHAR(80) NULL,
  effective_status VARCHAR(80) NULL,
  manager_url TEXT NULL,
  payload JSON NULL,
  captured_at DATETIME NULL,
  failure_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_poll_at DATETIME NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_meta_managed_review_ad (ad_id),
  INDEX idx_meta_managed_review_poll (next_poll_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
