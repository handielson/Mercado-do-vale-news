CREATE TABLE IF NOT EXISTS meta_campaign_follower_tracking (
  campaign_id VARCHAR(120) NOT NULL PRIMARY KEY,
  campaign_name VARCHAR(255) NOT NULL,
  instagram_account_id VARCHAR(80) NOT NULL,
  baseline_followers INT UNSIGNED NULL,
  baseline_at DATETIME NULL,
  baseline_source VARCHAR(40) NULL,
  latest_followers INT UNSIGNED NULL,
  latest_at DATETIME NULL,
  last_effective_status VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_meta_follower_tracking_instagram (instagram_account_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
