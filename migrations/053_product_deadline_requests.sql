-- Solicitações de prazo feitas nos dois sites. Não cria pedido, reserva ou cobrança.
CREATE TABLE IF NOT EXISTS product_deadline_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  public_code VARCHAR(20) NOT NULL,
  storefront ENUM('mercado_do_vale','loja_3d') NOT NULL,
  product_id CHAR(36) NOT NULL,
  sku_snapshot VARCHAR(191) NOT NULL,
  product_name_snapshot VARCHAR(255) NOT NULL,
  quantity_requested INT UNSIGNED NOT NULL,
  lead_time_label_snapshot VARCHAR(120) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  customer_email VARCHAR(254) NULL,
  customer_message VARCHAR(1000) NULL,
  status ENUM('new','contacted','negotiating','approved','declined','closed') NOT NULL DEFAULT 'new',
  negotiated_business_days SMALLINT UNSIGNED NULL,
  admin_notes VARCHAR(2000) NULL,
  whatsapp_notification_status ENUM('pending','sent','unconfigured','failed') NOT NULL DEFAULT 'pending',
  whatsapp_notification_error VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_deadline_request_code (public_code),
  KEY idx_product_deadline_storefront_status (storefront,status,created_at),
  KEY idx_product_deadline_product (product_id,created_at),
  KEY idx_product_deadline_phone (customer_phone,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reversão operacional: manter os registros e retirar os pontos de entrada da interface.
