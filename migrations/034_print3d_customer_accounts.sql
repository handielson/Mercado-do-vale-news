-- Contas independentes da loja 3D. Preparada a partir do schema real da VPS
-- consultado somente para leitura em 26/09/2026. Aplicar após 033, com backup
-- e validação em ambiente de teste. Não cria contas nem envia mensagens.

CREATE TABLE IF NOT EXISTS print3d_customers (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(20) NULL,
  cpf_cnpj VARCHAR(14) NULL,
  birth_date DATE NULL,
  address JSON NULL,
  email_verified_at DATETIME NULL,
  marketing_email_opt_in_at DATETIME NULL,
  marketing_whatsapp_opt_in_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_print3d_customers_email (email),
  UNIQUE KEY uq_print3d_customers_document (cpf_cnpj),
  UNIQUE KEY uq_print3d_customers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS print3d_customer_auth (
  customer_id CHAR(36) NOT NULL,
  password_hash TEXT NOT NULL,
  salt VARCHAR(64) NOT NULL,
  auth_version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  CONSTRAINT fk_print3d_customer_auth_customer FOREIGN KEY (customer_id)
    REFERENCES print3d_customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS print3d_customer_tokens (
  id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  purpose ENUM('verify_email', 'reset_password') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_print3d_customer_token_hash (token_hash),
  KEY idx_print3d_customer_tokens_customer (customer_id, purpose, created_at),
  KEY idx_print3d_customer_tokens_expiry (expires_at),
  CONSTRAINT fk_print3d_customer_token_customer FOREIGN KEY (customer_id)
    REFERENCES print3d_customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
  ADD COLUMN print3d_customer_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER customer_id,
  ADD KEY idx_orders_print3d_customer (print3d_customer_id),
  ADD CONSTRAINT fk_orders_print3d_customer FOREIGN KEY (print3d_customer_id)
    REFERENCES print3d_customers(id);

-- customers/customer_auth do Mercado do Vale e suas restrições de e-mail/CPF
-- permanecem intocados. A mesma pessoa pode se cadastrar nas duas lojas.
-- O checkout 3D preencherá print3d_customer_id, e não orders.customer_id.
-- Login, recuperação, sessões e comunicações 3D exigem rotas próprias antes
-- de ativar cadastro público. Não apagar estas tabelas após existirem pedidos.
