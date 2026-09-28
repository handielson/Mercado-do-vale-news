CREATE TABLE IF NOT EXISTS print3d_storefront_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  maintenance_mode TINYINT(1) NOT NULL DEFAULT 0,
  maintenance_message VARCHAR(500) NOT NULL DEFAULT 'Estamos preparando novidades e melhorias. A 3DMV volta em breve.',
  updated_by CHAR(36) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO print3d_storefront_settings (id, maintenance_mode, maintenance_message)
VALUES (1, 0, 'Estamos preparando novidades e melhorias. A 3DMV volta em breve.');
