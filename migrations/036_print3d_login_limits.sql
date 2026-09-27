-- Apply only after 034/035, in the approved environment before enabling accounts.
-- Hash keys never contain a raw CPF, phone, e-mail or IP. No MDV account changes.
CREATE TABLE IF NOT EXISTS print3d_login_limits (
  bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  failures INT UNSIGNED NOT NULL DEFAULT 0,
  window_start BIGINT UNSIGNED NOT NULL DEFAULT 0,
  blocked_until BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;
