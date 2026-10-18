-- Durable state for Meta direct messages. Historical inbox entries are never replayed on activation.
CREATE TABLE IF NOT EXISTS meta_attendance_runtime (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 activation_event_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 activation_at TIMESTAMP(3) NULL,
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
INSERT IGNORE INTO meta_attendance_runtime (id) VALUES (1);
CREATE TABLE IF NOT EXISTS meta_attendance_conversations (
 conversation_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 conversation_key VARCHAR(3200) NOT NULL,
 channel VARCHAR(20) NOT NULL,
 account_id VARCHAR(255) NOT NULL,
 participant_id VARCHAR(255) NOT NULL,
 conversation_state JSON NULL,
 state_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 state_event_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
 sales_preferences JSON NULL,
 paused_until TIMESTAMP(3) NULL,
 paused_by VARCHAR(60) NULL,
 handoff_event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS meta_attendance_jobs (
 event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 conversation_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 inbox_id BIGINT UNSIGNED NOT NULL,
 status ENUM('planning','ready','completed','suppressed','failed','result_unknown') NOT NULL,
 response_json JSON NULL,
 error_code VARCHAR(80) NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 INDEX idx_meta_jobs_conversation (conversation_hash,status,inbox_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS meta_attendance_outbox (
 event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 block_index SMALLINT UNSIGNED NOT NULL,
 message_json JSON NOT NULL,
 status ENUM('pending','sending','sent','suppressed','failed','result_unknown') NOT NULL DEFAULT 'pending',
 provider_message_id VARCHAR(255) NULL,
 error_code VARCHAR(80) NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY (event_key,block_index),
 INDEX idx_meta_outbox_provider (provider_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
