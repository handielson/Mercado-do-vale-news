-- ============================================================
-- MIGRATION 006: Termo de garantia por aparelho serializado
-- Aplicar no SQL da VPS
-- ============================================================
-- Cada aparelho serializado vendido recebe seu próprio termo de garantia
-- com número de documento único (warranty_documents.id) e prazo individual
-- (resolvido por marca/categoria/template custom no momento da geração).

ALTER TABLE warranty_documents
  ADD COLUMN IF NOT EXISTS serialized_unit_id UUID;
-- FK não definida porque units mora na VPS MySQL (cross-DB). UUID puro.

CREATE INDEX IF NOT EXISTS idx_warranty_documents_serialized_unit_id
  ON warranty_documents(serialized_unit_id);
CREATE INDEX IF NOT EXISTS idx_warranty_documents_sale_id
  ON warranty_documents(sale_id);
