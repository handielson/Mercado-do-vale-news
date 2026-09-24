-- Aplicar explicitamente após backup, antes de ativar MDV_FISCAL_AUTO_CANCEL_ENABLED.
-- Uma linha por documento impede envio concorrente/repetido do evento 110111.
CREATE TABLE IF NOT EXISTS company_fiscal_cancellation_monitor (
  document_id CHAR(36) NOT NULL PRIMARY KEY,
  profile_id CHAR(36) NOT NULL,
  state ENUM('pending','open_alert','sending','accepted_pending_confirmation','confirmed','rejected','uncertain','blocked') NOT NULL DEFAULT 'pending',
  marketplace_status VARCHAR(40) NOT NULL DEFAULT '',
  reason VARCHAR(255) NULL,
  event_protocol VARCHAR(30) NULL,
  signed_event_xml MEDIUMTEXT NULL,
  response_xml MEDIUMTEXT NULL,
  attempted_at DATETIME NULL,
  checked_at DATETIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_fiscal_cancel_monitor (profile_id,state,updated_at),
  CONSTRAINT fk_fiscal_cancel_monitor_document FOREIGN KEY (document_id) REFERENCES company_fiscal_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Rollback operacional: desligar MDV_FISCAL_AUTO_CANCEL_ENABLED e preservar a tabela de auditoria.
