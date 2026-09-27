-- Aplicar explicitamente após backup, antes de ativar MDV_PRINT3D_RECIPES_ENABLED=1.
-- Metadados privados: não contém binários nem torna arquivos do NAS públicos.
CREATE TABLE IF NOT EXISTS print3d_recipe_revisions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  sku_snapshot VARCHAR(80) NOT NULL,
  revision VARCHAR(80) NOT NULL,
  draft_json JSON NOT NULL,
  draft_sha256 CHAR(64) NOT NULL,
  created_by VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_print3d_recipe_product_revision (product_id, revision),
  UNIQUE KEY uq_print3d_recipe_product_id (product_id, id),
  KEY idx_print3d_recipe_product_created (product_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reversão operacional: desligar MDV_PRINT3D_RECIPES_ENABLED.
-- Preservar a tabela para auditoria; remoção dos dados exige decisão separada.
