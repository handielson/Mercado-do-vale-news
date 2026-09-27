-- Independent from 3D accounts. Apply before enabling MDV_CUSTOMER_AUTH_SECURITY_ENABLED.
CREATE TABLE IF NOT EXISTS customer_login_limits (
  bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  failures INT UNSIGNED NOT NULL DEFAULT 0,
  window_start BIGINT UNSIGNED NOT NULL DEFAULT 0,
  blocked_until BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;
