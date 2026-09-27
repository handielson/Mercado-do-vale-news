-- Fundação local. Aplicar somente após 033/034, com backup e autorização.
-- O plano é imutável e nasce na transação do checkout; não cria pedidos.
CREATE TABLE IF NOT EXISTS print3d_order_plans (
  order_id CHAR(36) NOT NULL PRIMARY KEY,
  public_number BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subtotal_cents BIGINT UNSIGNED NOT NULL,
  ready_amount_cents BIGINT UNSIGNED NOT NULL,
  preorder_amount_cents BIGINT UNSIGNED NOT NULL,
  deposit_amount_cents BIGINT UNSIGNED NOT NULL,
  due_on_confirmation_cents BIGINT UNSIGNED NOT NULL,
  due_before_shipping_cents BIGINT UNSIGNED NOT NULL,
  plan_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_print3d_order_public_number (public_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS print3d_order_item_plans (
  order_item_id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  ready_quantity INT UNSIGNED NOT NULL,
  preorder_quantity INT UNSIGNED NOT NULL,
  production_days INT UNSIGNED NULL,
  unit_price_cents BIGINT UNSIGNED NOT NULL,
  subtotal_cents BIGINT UNSIGNED NOT NULL,
  deposit_amount_cents BIGINT UNSIGNED NOT NULL,
  balance_before_shipping_cents BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_print3d_order_plan_product (order_id, product_id),
  CONSTRAINT fk_print3d_item_plan_order_plan FOREIGN KEY (order_id)
    REFERENCES print3d_order_plans(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Somente confirmações autenticadas do futuro processador de pagamentos.
-- Não representa uma integração com gateway já operacional.
CREATE TABLE IF NOT EXISTS print3d_order_payment_receipts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  event_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider_payment_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  status ENUM('confirmed') NOT NULL DEFAULT 'confirmed',
  confirmed_at DATETIME NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_print3d_payment_event (provider, event_key),
  UNIQUE KEY uq_print3d_provider_payment (provider, provider_payment_id),
  KEY idx_print3d_receipts_order (order_id, status),
  CONSTRAINT fk_print3d_receipt_order_plan FOREIGN KEY (order_id)
    REFERENCES print3d_order_plans(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reversão: desligar consumidor de planos/produção; preservar histórico.
