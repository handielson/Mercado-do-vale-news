-- ============================================================
-- MIGRATION 004: Gestão de Unidades Serializadas (IMEI)
-- Aplicar no SQL da VPS
-- Data: 2026-04-02
-- ============================================================

-- ------------------------------------------------------------
-- 1. Estender tabela units com rastreio de pedidos/vendas
-- ------------------------------------------------------------

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_id      UUID REFERENCES sales(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reserved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sold_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS condition    TEXT NOT NULL DEFAULT 'new', -- new, open_box, refurbished, defective
  ADD COLUMN IF NOT EXISTS cost_price   INTEGER; -- custo em centavos (opcional)

-- Índice para IMEI 2 (IMEI 1 já existe no schema original)
CREATE INDEX IF NOT EXISTS idx_units_imei_2 ON units(imei_2);

-- ------------------------------------------------------------
-- 2. Estender tabela order_items com vinculação de unidade
-- ------------------------------------------------------------

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS serialized_unit_id UUID REFERENCES units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_serialized_unit_id ON order_items(serialized_unit_id);

-- ------------------------------------------------------------
-- 3. Estender tabela orders com flag de liberação de docs
-- ------------------------------------------------------------

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS serialized_docs_released BOOLEAN NOT NULL DEFAULT FALSE;
-- TRUE = cliente pode ver IMEI e reimprimir documentos

-- ------------------------------------------------------------
-- 4. Nova tabela: unit_swap_logs (auditoria de trocas)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS unit_swap_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
  sale_id     UUID REFERENCES sales(id)  ON DELETE SET NULL,
  old_unit_id UUID REFERENCES units(id)  ON DELETE SET NULL,
  new_unit_id UUID REFERENCES units(id)  ON DELETE SET NULL,
  reason      TEXT NOT NULL,             -- Motivo da troca
  swapped_by  TEXT,                      -- user_id ou "system"
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_swap_logs_order_id    ON unit_swap_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_unit_swap_logs_old_unit_id ON unit_swap_logs(old_unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_swap_logs_new_unit_id ON unit_swap_logs(new_unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_swap_logs_company_id  ON unit_swap_logs(company_id);

-- RLS para unit_swap_logs
ALTER TABLE unit_swap_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company swap logs"
  ON unit_swap_logs FOR SELECT
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can insert swap logs for their company"
  ON unit_swap_logs FOR INSERT
  WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- ------------------------------------------------------------
-- 5. Nova tabela: rma_logs (histórico de devoluções)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rma_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  unit_id     UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id)  ON DELETE SET NULL,
  sale_id     UUID REFERENCES sales(id)   ON DELETE SET NULL,
  reason      TEXT NOT NULL,             -- Motivo da devolução
  resolution  TEXT,                      -- repaired, scrapped, returned_to_supplier
  resolved_at TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rma_logs_unit_id    ON rma_logs(unit_id);
CREATE INDEX IF NOT EXISTS idx_rma_logs_order_id   ON rma_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_rma_logs_company_id ON rma_logs(company_id);

-- Trigger updated_at
CREATE TRIGGER update_rma_logs_updated_at
  BEFORE UPDATE ON rma_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS para rma_logs
ALTER TABLE rma_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company rma logs"
  ON rma_logs FOR SELECT
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can insert rma logs for their company"
  ON rma_logs FOR INSERT
  WITH CHECK (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

CREATE POLICY "Users can update their company rma logs"
  ON rma_logs FOR UPDATE
  USING (company_id::text = (auth.jwt() -> 'app_metadata' ->> 'company_id'));

-- ------------------------------------------------------------
-- 6. Atualizar status disponíveis da tabela units
--    Schema original: available, sold, reserved, defective
--    Adicionamos:     rma, scrapped
--    (sem restrição de check — TEXT é flexível o suficiente)
-- ------------------------------------------------------------
-- Nenhuma alteração necessária — status é TEXT livre.
-- Documentamos os valores aceitos:
-- available  → livre para venda
-- reserved   → vinculado a pedido, aguardando entrega
-- sold       → entregue ao cliente (imutável)
-- rma        → em processo de devolução
-- scrapped   → descartado (perda total)
-- defective  → defeito detectado antes da venda

-- ------------------------------------------------------------
-- VERIFICAÇÃO FINAL
-- ------------------------------------------------------------
-- Executar após a migration para confirmar:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'units' ORDER BY ordinal_position;
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('unit_swap_logs', 'rma_logs');
