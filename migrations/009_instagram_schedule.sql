CREATE TABLE IF NOT EXISTS instagram_schedule (
  id CHAR(36) PRIMARY KEY,
  day_of_week TINYINT UNSIGNED NOT NULL,
  scheduled_time TIME NOT NULL,
  content_type ENUM('story', 'reels', 'carrossel', 'post') NOT NULL DEFAULT 'story',
  hook TEXT NULL,
  caption TEXT NULL,
  cta TEXT NULL,
  hashtags TEXT NULL,
  visual_notes TEXT NULL,
  send_telegram_reminder TINYINT(1) NOT NULL DEFAULT 1,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_instagram_schedule_day (day_of_week, active, scheduled_time),
  INDEX idx_instagram_schedule_reminder (active, send_telegram_reminder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
