-- Arquivo físico imutável e compartilhável entre fichas/variantes.
-- O vínculo da ficha continua em print3d_recipe_files; o binário existe uma só vez no NAS.
CREATE TABLE IF NOT EXISTS print3d_file_assets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  sha256 CHAR(64) NOT NULL,
  storage_name VARCHAR(100) NOT NULL,
  synology_path VARCHAR(512) NOT NULL,
  byte_size BIGINT UNSIGNED NOT NULL,
  created_by VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_print3d_file_asset_hash (sha256),
  UNIQUE KEY uq_print3d_file_asset_path (synology_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE print3d_recipe_files
  ADD COLUMN asset_id CHAR(36) NULL AFTER id;

INSERT INTO print3d_file_assets
  (id,sha256,storage_name,synology_path,byte_size,created_by,created_at)
SELECT UUID(),source.sha256,source.storage_name,source.synology_path,source.byte_size,source.created_by,source.created_at
FROM print3d_recipe_files source
JOIN (
  SELECT sha256,MIN(id) AS source_id
  FROM print3d_recipe_files
  GROUP BY sha256
) canonical ON canonical.source_id=source.id
ON DUPLICATE KEY UPDATE sha256=VALUES(sha256);

UPDATE print3d_recipe_files relation
JOIN print3d_file_assets asset ON asset.sha256=relation.sha256
SET relation.asset_id=asset.id
WHERE relation.asset_id IS NULL;

ALTER TABLE print3d_recipe_files
  MODIFY COLUMN asset_id CHAR(36) NOT NULL,
  ADD KEY idx_print3d_recipe_file_asset (asset_id),
  ADD CONSTRAINT fk_print3d_recipe_file_asset FOREIGN KEY (asset_id)
    REFERENCES print3d_file_assets(id) ON DELETE RESTRICT;

-- Reversão operacional: desligar MDV_PRINT3D_RECIPES_ENABLED.
-- Não apagar assets ou vínculos usados por fichas e ordens antigas.
