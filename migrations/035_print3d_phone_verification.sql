-- Confirmação de WhatsApp exclusiva da loja 3D. Aplicar somente após 034,
-- em homologação e depois na janela de publicação aprovada. Não envia mensagens.

ALTER TABLE print3d_customers
  ADD COLUMN phone_verified_at DATETIME NULL AFTER phone;

CREATE TABLE IF NOT EXISTS print3d_phone_verifications (
  phone VARCHAR(13) NOT NULL PRIMARY KEY,
  challenge_id VARCHAR(64) NOT NULL UNIQUE,
  owner_key VARCHAR(100) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at BIGINT NOT NULL,
  sent TINYINT NOT NULL DEFAULT 0,
  proof_hash CHAR(64) NULL,
  proof_expires_at BIGINT NULL,
  consumed TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS print3d_phone_verification_limits (
  bucket_key CHAR(64) NOT NULL PRIMARY KEY,
  window_start BIGINT NOT NULL,
  last_request BIGINT NOT NULL,
  requests INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Somente phone_verified_at != NULL e phone compatível permitem encomenda.
-- O consumidor do checkout deve ler estes campos no banco sob transação.
