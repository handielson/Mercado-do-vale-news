-- Migration: adiciona campos de origem do frete na tabela sales
-- Necessário para o sistema Dual-Depot: saber de qual depósito o pedido deve ser enviado

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS shipping_origin_cep TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS shipping_origin_label TEXT DEFAULT NULL;

COMMENT ON COLUMN sales.shipping_origin_cep IS 'CEP do depósito de origem escolhido para despachar o pedido (ex: 56000-000)';
COMMENT ON COLUMN sales.shipping_origin_label IS 'Label do depósito de origem (ex: Petrolina, Juazeiro)';

-- Verificação
SELECT id, shipping_origin_cep, shipping_origin_label FROM sales LIMIT 1;
