-- Adiciona todas as colunas de entrega e custo que estão no código mas faltam na tabela sales
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS delivery_cost_store    INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_cost_customer INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_total         INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_total             INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS profit                 INTEGER DEFAULT 0;

COMMENT ON COLUMN sales.delivery_cost_store    IS 'Custo de entrega absorvido pela loja, em centavos';
COMMENT ON COLUMN sales.delivery_cost_customer IS 'Custo de entrega cobrado do cliente, em centavos';
COMMENT ON COLUMN sales.delivery_total         IS 'Custo total de entrega (store + customer), em centavos';
COMMENT ON COLUMN sales.cost_total             IS 'Custo total dos produtos (CMV), em centavos';
COMMENT ON COLUMN sales.profit                 IS 'Lucro bruto da venda, em centavos';
