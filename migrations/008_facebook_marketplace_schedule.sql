CREATE TABLE IF NOT EXISTS facebook_marketplace_schedule (
  id CHAR(36) PRIMARY KEY,
  product_id CHAR(36) NULL,
  product_name VARCHAR(255) NOT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  image_urls JSON NULL,
  destinations JSON NULL,
  scheduled_for DATETIME NOT NULL,
  status ENUM('scheduled', 'ready', 'published', 'cancelled') NOT NULL DEFAULT 'scheduled',
  notes TEXT NULL,
  published_url TEXT NULL,
  published_at DATETIME NULL,
  reminder_sent_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_facebook_marketplace_due (status, scheduled_for),
  INDEX idx_facebook_marketplace_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
