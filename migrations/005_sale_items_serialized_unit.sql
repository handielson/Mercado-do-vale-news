-- ============================================================
-- MIGRATION 005: Vincular sale_items à unit serializada (PDV)
-- Aplicar no Supabase SQL Editor
-- ============================================================
-- A migration 004 adicionou serialized_unit_id em order_items (loja online),
-- mas esqueceu sale_items (PDV). Sem essa coluna, não dá pra reconstruir qual
-- IMEI foi vendido em qual item da venda.

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS serialized_unit_id UUID;
-- FK não definida porque units mora na VPS MySQL (cross-DB). UUID puro.

CREATE INDEX IF NOT EXISTS idx_sale_items_serialized_unit_id
  ON sale_items(serialized_unit_id);
