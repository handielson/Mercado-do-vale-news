-- ============================================================
-- Migration: Sistema de Pedidos Online (E-commerce)
-- Tabelas: orders, order_items
-- Executar no SQL Editor do Supabase
-- ============================================================

-- ─── 1. Enum de status do pedido ─────────────────────────────────────────────

CREATE TYPE order_status AS ENUM (
    'pending',           -- Aguardando pagamento/confirmação
    'awaiting_payment',  -- Pagamento iniciado (PIX gerado, checkout aberto)
    'paid',              -- Pagamento confirmado pelo gateway (webhook)
    'preparing',         -- Em preparação / separação
    'shipped',           -- Enviado / saiu para entrega
    'delivered',         -- Entregue ao cliente
    'completed',         -- Concluído (pagamento na entrega + admin finalizou)
    'cancelled'          -- Cancelado
);

CREATE TYPE order_payment_status AS ENUM (
    'pending', 'paid', 'failed', 'refunded'
);

-- ─── 2. Tabela principal: orders ─────────────────────────────────────────────

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Cliente (pode ser anônimo)
    customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name       TEXT NOT NULL,
    customer_phone      TEXT NOT NULL,
    customer_email      TEXT,

    -- Status
    status              order_status NOT NULL DEFAULT 'pending',
    payment_status      order_payment_status NOT NULL DEFAULT 'pending',

    -- Pagamento
    payment_method      TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'on_delivery')),
    payment_gateway     TEXT CHECK (payment_gateway IN ('mercado_pago', 'pagseguro', 'stripe', 'pagleve')),
    gateway_payment_id  TEXT,        -- ID da transação no gateway
    gateway_payment_url TEXT,        -- URL de checkout

    -- Entrega
    delivery_type       TEXT NOT NULL CHECK (delivery_type IN ('pickup', 'delivery')),
    shipping_address    JSONB,        -- { cep, street, number, complement, neighborhood, city, state }
    shipping_cost       INTEGER NOT NULL DEFAULT 0,  -- em centavos

    -- Valores (todos em centavos)
    subtotal            INTEGER NOT NULL DEFAULT 0,
    discount            INTEGER NOT NULL DEFAULT 0,
    total               INTEGER NOT NULL DEFAULT 0,

    -- Cupom
    coupon_code         TEXT,
    coupon_discount     INTEGER DEFAULT 0,  -- em centavos

    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. Tabela de itens: order_items ─────────────────────────────────────────

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name    TEXT NOT NULL,
    product_sku     TEXT,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      INTEGER NOT NULL,  -- em centavos
    subtotal        INTEGER NOT NULL,  -- em centavos
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. Trigger: updated_at automático ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verifica se já existe trigger antes de criar (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'orders_updated_at'
    ) THEN
        CREATE TRIGGER orders_updated_at
            BEFORE UPDATE ON orders
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- ─── 5. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX idx_orders_company_id    ON orders (company_id);
CREATE INDEX idx_orders_status        ON orders (status);
CREATE INDEX idx_orders_created_at    ON orders (created_at DESC);
CREATE INDEX idx_orders_customer_id   ON orders (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_orders_gateway_id    ON orders (gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX idx_order_items_order_id ON order_items (order_id);

-- ─── 6. RLS (Row Level Security) ─────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Admin: acesso total
CREATE POLICY "admin_full_access_orders"
    ON orders FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "admin_full_access_order_items"
    ON order_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Anônimo/público: só pode INSERT (criar pedido)
CREATE POLICY "anon_insert_orders"
    ON orders FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "anon_insert_order_items"
    ON order_items FOR INSERT
    TO anon
    WITH CHECK (true);

-- Anônimo pode ler SEU próprio pedido (pelo ID)
-- O front-end armazena o order_id no localStorage e passa via URL
CREATE POLICY "anon_read_own_order"
    ON orders FOR SELECT
    TO anon
    USING (true);  -- A filtragem por ID é feita no service

CREATE POLICY "anon_read_own_order_items"
    ON order_items FOR SELECT
    TO anon
    USING (true);

-- ─── 7. Comentários ──────────────────────────────────────────────────────────

COMMENT ON TABLE orders      IS 'Pedidos online (e-commerce). Separado de sales (PDV).';
COMMENT ON TABLE order_items IS 'Itens de pedidos online.';
COMMENT ON COLUMN orders.shipping_address IS 'JSONB: { cep, street, number, complement, neighborhood, city, state }';
COMMENT ON COLUMN orders.subtotal         IS 'Soma dos itens em centavos';
COMMENT ON COLUMN orders.discount         IS 'Desconto total (cupom) em centavos';
COMMENT ON COLUMN orders.total            IS 'subtotal - discount + shipping_cost em centavos';
