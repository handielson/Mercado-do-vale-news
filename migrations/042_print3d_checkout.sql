-- Preparação local após 034-041. Não aplicar sem backup e autorização.
-- Pedidos, itens e reservas usam as tabelas centrais existentes.
CREATE TABLE IF NOT EXISTS print3d_checkout_requests (
  customer_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  idempotency_key CHAR(36) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  order_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id,idempotency_key),
  UNIQUE KEY uq_print3d_checkout_order (order_id),
  CONSTRAINT fk_print3d_checkout_customer FOREIGN KEY (customer_id) REFERENCES print3d_customers(id),
  CONSTRAINT fk_print3d_checkout_plan FOREIGN KEY (order_id) REFERENCES print3d_order_plans(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS print3d_order_shipping (
  order_id CHAR(36) NOT NULL PRIMARY KEY,
  option_snapshot JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_print3d_shipping_plan FOREIGN KEY (order_id) REFERENCES print3d_order_plans(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Reversão: desabilitar MDV_PRINT3D_CHECKOUT_ENABLED e preservar histórico.

-- Fonte de verdade das localizações reservadas por este pedido. Uma futura
-- baixa/liberação deve travar pedido+produtos, validar pagamento/gateway e
-- registrar movimento; alterar apenas orders.status não libera a reserva.
CREATE TABLE IF NOT EXISTS print3d_order_stock_reservations (
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  stock_location_id CHAR(36) NOT NULL,
  deposit_id CHAR(36) NULL,
  location_id CHAR(36) NULL,
  quantity_reserved INT UNSIGNED NOT NULL,
  quantity_released INT UNSIGNED NOT NULL DEFAULT 0,
  quantity_consumed INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id,stock_location_id),
  KEY idx_print3d_reserved_product (product_id),
  CONSTRAINT fk_print3d_reserved_plan FOREIGN KEY (order_id) REFERENCES print3d_order_plans(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
