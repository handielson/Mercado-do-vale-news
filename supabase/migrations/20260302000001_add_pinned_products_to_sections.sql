-- Adicionar coluna pinned_product_ids para seleção manual de produtos em seções
ALTER TABLE catalog_sections 
ADD COLUMN IF NOT EXISTS pinned_product_ids UUID[];

COMMENT ON COLUMN catalog_sections.pinned_product_ids IS 'IDs de produtos fixados manualmente nesta seção (exibidos em vez dos automáticos quando preenchido)';
