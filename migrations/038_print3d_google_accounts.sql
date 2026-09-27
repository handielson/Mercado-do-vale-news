-- Local preparation only. Apply after 034-036 in an approved environment.
CREATE TABLE IF NOT EXISTS print3d_customer_google (
  customer_id CHAR(36) NOT NULL PRIMARY KEY,
  google_sub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_print3d_google_customer FOREIGN KEY (customer_id) REFERENCES print3d_customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Short-lived, single-use handoffs. No Google access/refresh/ID tokens stored.
CREATE TABLE IF NOT EXISTS print3d_google_handoffs (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  browser_challenge CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  google_sub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(254) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email_authoritative TINYINT(1) NOT NULL,
  link_customer_id CHAR(36) NULL,
  link_auth_version INT UNSIGNED NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  KEY idx_print3d_google_handoff_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
