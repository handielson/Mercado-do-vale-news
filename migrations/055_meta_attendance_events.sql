-- Piloto de recebimento Meta. Aplicar somente na publicacao autorizada.
-- Esta tabela e a caixa de entrada de eventos, nao a memoria comercial do n8n.
CREATE TABLE IF NOT EXISTS meta_attendance_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  channel VARCHAR(20) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  participant_id VARCHAR(255) NULL,
  conversation_key VARCHAR(3200) NULL,
  provider_event_id VARCHAR(255) NULL,
  surface VARCHAR(24) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  status ENUM('captured','ignored','unsupported') NOT NULL,
  normalized_event JSON NOT NULL,
  received_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_meta_attendance_event (event_key),
  INDEX idx_meta_attendance_status (status, id),
  INDEX idx_meta_attendance_account (channel, account_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
