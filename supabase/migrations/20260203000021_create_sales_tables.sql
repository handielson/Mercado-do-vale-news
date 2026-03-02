-- Migration: Criar tabelas para sistema de PDV
-- Data: 2026-02-03
-- Descrição: Tabelas para vendas (sales) e itens de venda (sale_items)

-- ============================================
-- Tabela: sales (Vendas)
-- ============================================
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referências (customer_id é OBRIGATÓRIO)
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    seller_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
    
    -- Valores (em centavos)
    subtotal INTEGER NOT NULL,           -- Soma dos itens (sem desconto)
    discount_total INTEGER DEFAULT 0,    -- Total de descontos aplicados (incluindo brindes)
    total INTEGER NOT NULL,              -- Valor final pago pelo cliente
    cost_total INTEGER NOT NULL,         -- Custo total dos produtos (para cálculo de lucro)
    profit INTEGER NOT NULL,             -- Lucro real (total - cost_total)
    
    -- Pagamentos (JSONB array)
    -- Formato: [{"method": "money", "amount": 200000}, {"method": "credit", "amount": 150000}]
    -- Methods: 'money' | 'credit' | 'debit' | 'pix'
    payment_methods JSONB NOT NULL,
    
    -- Metadata
    notes TEXT,                          -- Observações da venda
    status VARCHAR(20) DEFAULT 'completed' NOT NULL, -- completed, cancelled, refunded
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_seller ON sales(seller_id);
CREATE INDEX idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX idx_sales_status ON sales(status);

-- Comentários
COMMENT ON TABLE sales IS 'Vendas realizadas no PDV';
COMMENT ON COLUMN sales.customer_id IS 'Cliente da venda (OBRIGATÓRIO)';
COMMENT ON COLUMN sales.seller_id IS 'Vendedor que realizou a venda';
COMMENT ON COLUMN sales.subtotal IS 'Soma dos itens sem desconto (centavos)';
COMMENT ON COLUMN sales.discount_total IS 'Total de descontos incluindo brindes (centavos)';
COMMENT ON COLUMN sales.total IS 'Valor final pago pelo cliente (centavos)';
COMMENT ON COLUMN sales.cost_total IS 'Custo total dos produtos vendidos (centavos)';
COMMENT ON COLUMN sales.profit IS 'Lucro real da venda: total - cost_total (centavos)';
COMMENT ON COLUMN sales.payment_methods IS 'Array JSON com formas de pagamento: [{"method": "money", "amount": 200000}]';

-- ============================================
-- Tabela: sale_items (Itens da Venda)
-- ============================================
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referências
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- Snapshot do produto (para histórico)
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    
    -- Quantidades e Valores (em centavos)
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL,         -- Preço unitário na hora da venda
    unit_cost INTEGER NOT NULL,          -- Custo unitário (para cálculo de lucro)
    discount INTEGER DEFAULT 0,          -- Desconto por unidade (centavos)
    subtotal INTEGER NOT NULL,           -- (unit_price * quantity)
    total INTEGER NOT NULL,              -- (subtotal - discount * quantity)
    
    -- Flags
    is_gift BOOLEAN DEFAULT FALSE,       -- Se é produto brinde (desconto integral automático)
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_sale_items_is_gift ON sale_items(is_gift) WHERE is_gift = TRUE;

-- Comentários
COMMENT ON TABLE sale_items IS 'Itens individuais de cada venda';
COMMENT ON COLUMN sale_items.sale_id IS 'Venda à qual este item pertence';
COMMENT ON COLUMN sale_items.product_id IS 'Produto vendido (pode ser NULL se produto foi deletado)';
COMMENT ON COLUMN sale_items.product_name IS 'Nome do produto no momento da venda (snapshot)';
COMMENT ON COLUMN sale_items.quantity IS 'Quantidade vendida';
COMMENT ON COLUMN sale_items.unit_price IS 'Preço unitário no momento da venda (centavos)';
COMMENT ON COLUMN sale_items.unit_cost IS 'Custo unitário do produto (centavos)';
COMMENT ON COLUMN sale_items.discount IS 'Desconto por unidade (centavos)';
COMMENT ON COLUMN sale_items.is_gift IS 'Produto brinde (desconto integral automático)';

-- ============================================
-- Trigger: Atualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_updated_at();

-- ============================================
-- Exemplo de Uso
-- ============================================
-- Venda com 2 itens (1 normal + 1 brinde):
-- 
-- INSERT INTO sales (customer_id, seller_id, subtotal, discount_total, total, cost_total, profit, payment_methods)
-- VALUES (
--     'customer-uuid',
--     'seller-uuid',
--     352000,  -- R$ 3.520,00 (subtotal)
--     2000,    -- R$ 20,00 (desconto do brinde)
--     350000,  -- R$ 3.500,00 (total pago)
--     251000,  -- R$ 2.510,00 (custo)
--     99000,   -- R$ 990,00 (lucro)
--     '[{"method": "money", "amount": 200000}, {"method": "credit", "amount": 150000}]'
-- );
--
-- INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, discount, subtotal, total, is_gift)
-- VALUES 
--     ('sale-uuid', 'product1-uuid', 'iPhone 13 128GB', 1, 350000, 250000, 0, 350000, 350000, FALSE),
--     ('sale-uuid', 'product2-uuid', 'Camiseta Promo', 1, 2000, 1000, 2000, 2000, 0, TRUE);
