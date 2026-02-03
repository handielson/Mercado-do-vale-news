-- Migration: Adicionar campo is_gift para produtos brindes
-- Data: 2026-02-02
-- Descrição: Permite marcar produtos como brindes (desconto integral automático no PDV)

-- Adicionar campo is_gift na tabela products
ALTER TABLE products
ADD COLUMN is_gift BOOLEAN DEFAULT FALSE NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN products.is_gift IS 'Indica se o produto é um brinde. Produtos brindes recebem desconto integral automático no PDV, mas o custo é contabilizado no relatório de lucro.';

-- Criar índice para facilitar filtros de produtos brindes
CREATE INDEX idx_products_is_gift ON products(is_gift) WHERE is_gift = TRUE;

-- Exemplo de uso:
-- Cadastrar produto brinde:
-- INSERT INTO products (name, cost_price, sale_price, is_gift) 
-- VALUES ('Camiseta Promocional', 10.00, 20.00, TRUE);
--
-- No PDV:
-- - Produto aparece com preço R$ 20,00
-- - Desconto automático de R$ 20,00 é aplicado
-- - Cliente paga R$ 0,00
-- - Relatório contabiliza custo de R$ 10,00 no lucro
