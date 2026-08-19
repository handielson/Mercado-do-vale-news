-- Agendamento multicanal de Stories (Instagram e WhatsApp).
-- A API também executa CREATE TABLE IF NOT EXISTS no startup para instalações já existentes.

CREATE TABLE IF NOT EXISTS social_story_schedules (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  source_type ENUM('standalone','whatsapp_campaign') NOT NULL DEFAULT 'standalone',
  source_id CHAR(36) NULL,
  scheduled_at DATETIME NOT NULL,
  destinations JSON NOT NULL,
  status ENUM('pending_approval','approved','processing','completed','partial','failed','cancelled') NOT NULL DEFAULT 'pending_approval',
  approval_id CHAR(36) NULL,
  content_hash CHAR(64) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_social_story_schedule_due (status, scheduled_at),
  INDEX idx_social_story_schedule_approval (approval_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS social_story_items (
  id CHAR(36) PRIMARY KEY,
  schedule_id CHAR(36) NOT NULL,
  sequence_index INT UNSIGNED NOT NULL,
  media_type ENUM('image','video') NOT NULL,
  media_url VARCHAR(1200) NOT NULL,
  label VARCHAR(255) NULL,
  caption TEXT NULL,
  scheduled_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_social_story_sequence (schedule_id, sequence_index),
  INDEX idx_social_story_item_schedule (schedule_id, scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_story_deliveries (
  id CHAR(36) PRIMARY KEY,
  schedule_id CHAR(36) NOT NULL,
  item_id CHAR(36) NOT NULL,
  destination ENUM('instagram','whatsapp') NOT NULL,
  idempotency_key CHAR(64) NOT NULL,
  status ENUM('waiting_approval','pending','processing','published','failed','cancelled') NOT NULL DEFAULT 'waiting_approval',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  provider_container_id VARCHAR(160) NULL,
  provider_publication_id VARCHAR(160) NULL,
  last_error TEXT NULL,
  claimed_at DATETIME NULL,
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_social_story_delivery (idempotency_key),
  INDEX idx_social_story_delivery_due (status, destination, updated_at),
  INDEX idx_social_story_delivery_schedule (schedule_id, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
