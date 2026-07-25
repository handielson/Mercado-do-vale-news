-- Lista de Compras — MySQL/VPS
-- A API cria automaticamente esta estrutura em core/shopping-list-routes.cjs
-- durante o start. Este arquivo é o artefato de migration para auditoria e
-- execução manual em ambientes onde a API não é reiniciada.

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()), source_key VARCHAR(180) NULL UNIQUE,
  source_type ENUM('daily_sales','manual_product','manual_item') NOT NULL,
  product_id CHAR(36) NULL, item_name VARCHAR(255) NOT NULL, sku VARCHAR(120) NULL,
  requested_quantity INT NOT NULL, sales_quantity_today INT NOT NULL DEFAULT 0,
  current_stock INT NOT NULL DEFAULT 0,
  status ENUM('pending','quoted','purchased','cancelled') NOT NULL DEFAULT 'pending',
  notes TEXT NULL, cancelled_reason TEXT NULL, created_by VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shopping_list_status (status, updated_at), INDEX idx_shopping_list_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shopping_list_quotes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()), shopping_list_item_id CHAR(36) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL, purchase_location VARCHAR(255) NULL,
  unit_price DECIMAL(12,2) NOT NULL, quantity INT NOT NULL DEFAULT 1, quoted_at DATE NOT NULL,
  notes TEXT NULL, is_valid TINYINT(1) NOT NULL DEFAULT 1, created_by VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shopping_quote_item FOREIGN KEY (shopping_list_item_id) REFERENCES shopping_list_items(id) ON DELETE CASCADE,
  INDEX idx_shopping_quote_item_price (shopping_list_item_id, is_valid, unit_price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shopping_list_purchases (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()), shopping_list_item_id CHAR(36) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL, purchase_location VARCHAR(255) NULL,
  quantity INT NOT NULL, unit_price DECIMAL(12,2) NOT NULL, purchased_at DATE NOT NULL,
  notes TEXT NULL, operator_name VARCHAR(255) NOT NULL, created_by VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_shopping_purchase_item FOREIGN KEY (shopping_list_item_id) REFERENCES shopping_list_items(id) ON DELETE RESTRICT,
  INDEX idx_shopping_purchase_date (purchased_at, created_at), INDEX idx_shopping_purchase_item (shopping_list_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shopping_list_daily_sales (
  sale_date DATE NOT NULL, product_id CHAR(36) NOT NULL, item_name VARCHAR(255) NOT NULL,
  sku VARCHAR(120) NULL, quantity INT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sale_date, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
