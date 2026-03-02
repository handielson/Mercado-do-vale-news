-- Migration: Adicionar todos os campos de entrega faltantes na tabela sales
-- Os campos abaixo são usados no saleService.ts mas não existem na tabela

ALTER TABLE sales
    -- Campos de entrega (referência e tipo)
    ADD COLUMN IF NOT EXISTS delivery_type          VARCHAR(50),
    ADD COLUMN IF NOT EXISTS delivery_person_id     UUID REFERENCES team_members(id) ON DELETE SET NULL,

    -- Custos de entrega
    ADD COLUMN IF NOT EXISTS delivery_cost_store    INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_cost_customer INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_total         INTEGER DEFAULT 0;

-- Índice para performance em buscas por entregador
CREATE INDEX IF NOT EXISTS idx_sales_delivery_person ON sales(delivery_person_id);

COMMENT ON COLUMN sales.delivery_type           IS 'Tipo de entrega: store_delivery, hybrid_delivery, pickup, etc.';
COMMENT ON COLUMN sales.delivery_person_id      IS 'Membro da equipe responsável pela entrega';
COMMENT ON COLUMN sales.delivery_cost_store     IS 'Custo de entrega absorvido pela loja, em centavos';
COMMENT ON COLUMN sales.delivery_cost_customer  IS 'Custo de entrega cobrado do cliente, em centavos';
COMMENT ON COLUMN sales.delivery_total          IS 'Custo total de entrega (centavos)';
