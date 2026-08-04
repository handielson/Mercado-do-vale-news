CREATE TABLE IF NOT EXISTS facebook_marketplace_groups (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(700) NOT NULL,
  source ENUM('manual', 'chrome') NOT NULL DEFAULT 'manual',
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_synced_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_facebook_marketplace_group_url (url(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facebook_marketplace_campaigns (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category_id CHAR(36) NOT NULL,
  min_stock INT NOT NULL DEFAULT 1,
  interval_minutes INT NOT NULL DEFAULT 180,
  republish_cooldown_hours INT NOT NULL DEFAULT 168,
  daily_limit INT NOT NULL DEFAULT 4,
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '20:00:00',
  destinations JSON NULL,
  description_template TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_product_id CHAR(36) NULL,
  last_generated_at DATETIME NULL,
  next_run_at DATETIME NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_facebook_campaign_due (active, next_run_at),
  INDEX idx_facebook_campaign_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE facebook_marketplace_schedule
  ADD COLUMN campaign_id CHAR(36) NULL AFTER id,
  ADD COLUMN source ENUM('manual', 'campaign') NOT NULL DEFAULT 'manual' AFTER campaign_id,
  ADD INDEX idx_facebook_marketplace_campaign (campaign_id, scheduled_for);
