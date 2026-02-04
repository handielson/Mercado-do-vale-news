-- Migration: Adicionar sistema de entrega ao PDV
-- Data: 2026-02-03
-- Descrição: Campos para gerenciar entregas e créditos de entregadores

-- ============================================
-- 1. Adicionar campos de entrega na tabela sales
-- ============================================

ALTER TABLE sales ADD COLUMN delivery_type VARCHAR(20) CHECK (delivery_type IN ('store_pickup', 'store_delivery', 'hybrid_delivery'));
COMMENT ON COLUMN sales.delivery_type IS 'Tipo de entrega: store_pickup (retirada), store_delivery (entrega loja), hybrid_delivery (híbrida)';

ALTER TABLE sales ADD COLUMN delivery_person_id UUID REFERENCES team_members(id) ON DELETE SET NULL;
COMMENT ON COLUMN sales.delivery_person_id IS 'Entregador responsável (apenas para entregas)';

ALTER TABLE sales ADD COLUMN delivery_cost_store INTEGER DEFAULT 0;
COMMENT ON COLUMN sales.delivery_cost_store IS 'Custo de entrega pago pela loja (centavos)';

ALTER TABLE sales ADD COLUMN delivery_cost_customer INTEGER DEFAULT 0;
COMMENT ON COLUMN sales.delivery_cost_customer IS 'Custo de entrega pago pelo cliente (centavos)';

ALTER TABLE sales ADD COLUMN delivery_total INTEGER DEFAULT 0;
COMMENT ON COLUMN sales.delivery_total IS 'Total de entrega (store + customer) em centavos';

-- ============================================
-- 2. Criar tabela de créditos de entrega
-- ============================================

CREATE TABLE delivery_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referências
    delivery_person_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    
    -- Valores
    amount INTEGER NOT NULL CHECK (amount >= 0), -- em centavos
    delivery_type VARCHAR(20) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_delivery_credits_person ON delivery_credits(delivery_person_id);
CREATE INDEX idx_delivery_credits_sale ON delivery_credits(sale_id);
CREATE INDEX idx_delivery_credits_status ON delivery_credits(status);
CREATE INDEX idx_delivery_credits_created_at ON delivery_credits(created_at DESC);

-- Comentários
COMMENT ON TABLE delivery_credits IS 'Créditos de entrega para entregadores';
COMMENT ON COLUMN delivery_credits.delivery_person_id IS 'Entregador que recebe o crédito';
COMMENT ON COLUMN delivery_credits.sale_id IS 'Venda relacionada ao crédito';
COMMENT ON COLUMN delivery_credits.amount IS 'Valor do crédito em centavos';
COMMENT ON COLUMN delivery_credits.status IS 'Status do pagamento: pending, paid, cancelled';

-- ============================================
-- 3. Trigger para atualizar updated_at
-- ============================================

CREATE TRIGGER trigger_delivery_credits_updated_at
    BEFORE UPDATE ON delivery_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_updated_at(); -- Reutiliza função existente

-- ============================================
-- 4. View para resumo de créditos por entregador
-- ============================================

CREATE OR REPLACE VIEW delivery_person_earnings AS
SELECT 
    tm.id AS delivery_person_id,
    tm.name AS delivery_person_name,
    COUNT(dc.id) AS total_deliveries,
    SUM(dc.amount) AS total_earnings,
    SUM(CASE WHEN dc.status = 'pending' THEN dc.amount ELSE 0 END) AS pending_earnings,
    SUM(CASE WHEN dc.status = 'paid' THEN dc.amount ELSE 0 END) AS paid_earnings
FROM team_members tm
LEFT JOIN delivery_credits dc ON tm.id = dc.delivery_person_id
GROUP BY tm.id, tm.name;

COMMENT ON VIEW delivery_person_earnings IS 'Resumo de ganhos de cada entregador';

-- ============================================
-- 5. Exemplos de Uso
-- ============================================

-- Exemplo 1: Retirada na loja (sem entrega)
-- INSERT INTO sales (customer_id, delivery_type, subtotal, total, cost_total, profit, payment_methods)
-- VALUES (
--     'customer-uuid',
--     'store_pickup',
--     100000,  -- R$ 1.000,00
--     100000,  -- R$ 1.000,00
--     70000,   -- R$ 700,00
--     30000,   -- R$ 300,00
--     '[{"method": "money", "amount": 100000}]'
-- );

-- Exemplo 2: Entrega pela loja (R$ 30,00 - desconto integral)
-- INSERT INTO sales (customer_id, delivery_type, delivery_person_id, delivery_cost_store, delivery_total, subtotal, discount_total, total, cost_total, profit, payment_methods)
-- VALUES (
--     'customer-uuid',
--     'store_delivery',
--     'delivery-person-uuid',
--     3000,    -- R$ 30,00 (loja paga)
--     3000,    -- R$ 30,00 (total)
--     100000,  -- R$ 1.000,00 (produtos)
--     3000,    -- R$ 30,00 (desconto da entrega)
--     100000,  -- R$ 1.000,00 (cliente paga)
--     70000,   -- R$ 700,00
--     30000,   -- R$ 300,00
--     '[{"method": "money", "amount": 100000}]'
-- );
-- INSERT INTO delivery_credits (delivery_person_id, sale_id, amount, delivery_type)
-- VALUES ('delivery-person-uuid', 'sale-uuid', 3000, 'store_delivery');

-- Exemplo 3: Entrega híbrida (loja R$ 15, cliente R$ 15)
-- INSERT INTO sales (customer_id, delivery_type, delivery_person_id, delivery_cost_store, delivery_cost_customer, delivery_total, subtotal, discount_total, total, cost_total, profit, payment_methods)
-- VALUES (
--     'customer-uuid',
--     'hybrid_delivery',
--     'delivery-person-uuid',
--     1500,    -- R$ 15,00 (loja paga)
--     1500,    -- R$ 15,00 (cliente paga)
--     3000,    -- R$ 30,00 (total)
--     100000,  -- R$ 1.000,00 (produtos)
--     1500,    -- R$ 15,00 (desconto = parte da loja)
--     101500,  -- R$ 1.015,00 (cliente paga: 1000 + 15)
--     70000,   -- R$ 700,00
--     31500,   -- R$ 315,00 (lucro: 1015 - 700)
--     '[{"method": "money", "amount": 101500}]'
-- );
-- INSERT INTO delivery_credits (delivery_person_id, sale_id, amount, delivery_type)
-- VALUES ('delivery-person-uuid', 'sale-uuid', 3000, 'hybrid_delivery');
