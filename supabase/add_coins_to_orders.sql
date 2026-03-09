-- Adiciona colunas de uso de moedas na tabela de pedidos
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS coins_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS coins_discount INTEGER DEFAULT 0;

-- Atualiza os comentários da tabela para documentação
COMMENT ON COLUMN orders.coins_spent IS 'Quantidade de Moedas do Vale gastas neste pedido';
COMMENT ON COLUMN orders.coins_discount IS 'Desconto gerado pelas moedas (em centavos)';
