-- Aplicar após 028_print3d_recipe_revisions.sql, com backup e antes de habilitar uploads.
-- Binários permanecem no Synology privado; só metadados e hash ficam no MySQL.
CREATE TABLE IF NOT EXISTS print3d_recipe_files (
  id CHAR(36) NOT NULL PRIMARY KEY,
  recipe_id CHAR(36) NOT NULL,
  kind VARCHAR(24) NOT NULL,
  printer_profile VARCHAR(120) NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(100) NOT NULL,
  synology_path VARCHAR(512) NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_by VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_print3d_recipe_file_content (recipe_id, kind, sha256),
  UNIQUE KEY uq_print3d_recipe_file_pair (recipe_id, id),
  UNIQUE KEY uq_print3d_recipe_storage_name (recipe_id, storage_name),
  KEY idx_print3d_recipe_files (recipe_id, created_at),
  CONSTRAINT fk_print3d_recipe_file_revision FOREIGN KEY (recipe_id)
    REFERENCES print3d_recipe_revisions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reversão operacional: desligar MDV_PRINT3D_RECIPES_ENABLED.
-- Não excluir arquivos ou metadados de revisões já utilizadas em pedidos.
