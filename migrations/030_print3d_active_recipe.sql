-- Aplicar após 028 e 029, com backup, antes de habilitar a seleção de fichas.
-- Ponteiro mutável para novas produções; as revisões e os arquivos permanecem imutáveis.
CREATE TABLE IF NOT EXISTS print3d_active_recipes (
  product_id CHAR(36) NOT NULL PRIMARY KEY,
  recipe_id CHAR(36) NOT NULL,
  primary_file_id CHAR(36) NOT NULL,
  selected_by VARCHAR(191) NOT NULL,
  selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_print3d_active_recipe (product_id, recipe_id),
  KEY idx_print3d_active_primary_file (recipe_id, primary_file_id),
  CONSTRAINT fk_print3d_active_revision FOREIGN KEY (product_id, recipe_id)
    REFERENCES print3d_recipe_revisions(product_id, id),
  CONSTRAINT fk_print3d_active_primary_file FOREIGN KEY (recipe_id, primary_file_id)
    REFERENCES print3d_recipe_files(recipe_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reversão operacional: desligar MDV_PRINT3D_RECIPES_ENABLED.
-- Não apagar a seleção ou revisões já referenciadas por futuras ordens de produção.
