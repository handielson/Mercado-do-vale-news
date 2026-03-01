-- Adiciona coluna delivery_cost_customer na tabela sales
-- Armazena o custo de entrega cobrado do cliente (em centavos)
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS delivery_cost_customer INTEGER DEFAULT 0;

COMMENT ON COLUMN sales.delivery_cost_customer IS 'Valor de frete cobrado do cliente, em centavos';
