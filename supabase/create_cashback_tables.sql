-- ============================================================
-- SISTEMA DE MOEDAS DO VALE
-- Executar no SQL Editor do Supabase
-- ============================================================

-- 1. CONFIGURAÇÕES DO ADMIN
-- ============================================================
CREATE TABLE IF NOT EXISTS cashback_settings (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Acúmulo por compra
    coins_per_real            NUMERIC(10,2) NOT NULL DEFAULT 1,    -- moedas por R$ gasto
    min_purchase_for_coins    NUMERIC(10,2) NOT NULL DEFAULT 0,    -- pedido mínimo para ganhar
    -- Resgate
    coins_to_brl_rate         NUMERIC(10,4) NOT NULL DEFAULT 100,  -- quantas moedas = R$ 1,00
    max_redeem_percent        INTEGER       NOT NULL DEFAULT 20,   -- máx % do pedido pago com moedas
    min_coins_to_redeem       INTEGER       NOT NULL DEFAULT 100,  -- saldo mínimo para resgatar
    -- Check-in diário
    checkin_base_coins        INTEGER       NOT NULL DEFAULT 5,    -- moedas base por check-in
    checkin_streak_milestones JSONB         NOT NULL DEFAULT '[{"day":7,"bonus":10},{"day":14,"bonus":20},{"day":30,"bonus":50}]',
    -- Expiração
    coins_expire_after_days   INTEGER,                            -- NULL = nunca expira
    -- Status
    active                    BOOLEAN       NOT NULL DEFAULT true,
    updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Garante que existe sempre apenas 1 linha de config
INSERT INTO cashback_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

-- RLS: admin lê e escreve, anônimos leem
ALTER TABLE cashback_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashback_settings_admin" ON cashback_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cashback_settings_public_read" ON cashback_settings
    FOR SELECT TO anon USING (true);

-- 2. SALDO POR CLIENTE
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_balances (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
    balance          INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned  INTEGER NOT NULL DEFAULT 0,
    lifetime_spent   INTEGER NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_balances_customer ON coin_balances(customer_id);

-- RLS: cada cliente vê só o próprio saldo; admin vê tudo
ALTER TABLE coin_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coin_balances_self" ON coin_balances
    FOR ALL TO authenticated
    USING (customer_id = auth.uid() OR EXISTS (
        SELECT 1 FROM customers WHERE id = auth.uid() AND customer_type = 'ADMIN'
    ));

-- 3. HISTÓRICO DE TRANSAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount          INTEGER NOT NULL,                   -- positivo = ganhou, negativo = gastou
    type            TEXT NOT NULL CHECK (type IN (
                        'earn_purchase',   -- ganhou por compra
                        'earn_checkin',    -- ganhou por check-in
                        'earn_streak',     -- bônus de streak
                        'earn_manual',     -- crédito manual pelo admin
                        'spend_discount',  -- usado como desconto
                        'refund_cancel',   -- estorno por cancelamento
                        'expire',          -- expirado
                        'admin_adjust'     -- ajuste admin (positivo ou negativo)
                    )),
    description     TEXT,
    reference_id    UUID,               -- ID da venda, check-in, etc.
    reference_type  TEXT CHECK (reference_type IN ('sale','quote','checkin','admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_customer ON coin_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_tx_reference ON coin_transactions(reference_id) WHERE reference_id IS NOT NULL;

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coin_tx_self" ON coin_transactions
    FOR SELECT TO authenticated
    USING (customer_id = auth.uid() OR EXISTS (
        SELECT 1 FROM customers WHERE id = auth.uid() AND customer_type = 'ADMIN'
    ));
CREATE POLICY "coin_tx_admin_write" ON coin_transactions
    FOR INSERT TO authenticated WITH CHECK (true);

-- 4. CHECK-INS DIÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS checkin_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    checkin_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    coins_earned  INTEGER NOT NULL,
    streak_day    INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(customer_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_checkin_customer ON checkin_logs(customer_id, checkin_date DESC);

ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkin_self" ON checkin_logs
    FOR ALL TO authenticated
    USING (customer_id = auth.uid() OR EXISTS (
        SELECT 1 FROM customers WHERE id = auth.uid() AND customer_type = 'ADMIN'
    ));

-- ============================================================
-- RPCs ATÔMICAS
-- ============================================================

-- Adicionar moedas (earn)
CREATE OR REPLACE FUNCTION add_coins(
    p_customer_id  UUID,
    p_amount       INTEGER,
    p_type         TEXT,
    p_description  TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Garantir que o saldo existe
    INSERT INTO coin_balances(customer_id, balance, lifetime_earned)
    VALUES (p_customer_id, p_amount, p_amount)
    ON CONFLICT (customer_id) DO UPDATE
        SET balance         = coin_balances.balance + p_amount,
            lifetime_earned = coin_balances.lifetime_earned + p_amount,
            updated_at      = now();

    -- Registrar transação
    INSERT INTO coin_transactions(customer_id, amount, type, description, reference_id, reference_type)
    VALUES (p_customer_id, p_amount, p_type, p_description, p_reference_id, p_reference_type);
END;
$$;

-- Debitar moedas (spend)
CREATE OR REPLACE FUNCTION spend_coins(
    p_customer_id  UUID,
    p_amount       INTEGER,
    p_type         TEXT,
    p_description  TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_balance INTEGER;
BEGIN
    SELECT balance INTO v_current_balance FROM coin_balances WHERE customer_id = p_customer_id;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Saldo insuficiente de Moedas do Vale';
    END IF;

    UPDATE coin_balances
    SET balance       = balance - p_amount,
        lifetime_spent = lifetime_spent + p_amount,
        updated_at    = now()
    WHERE customer_id = p_customer_id;

    INSERT INTO coin_transactions(customer_id, amount, type, description, reference_id, reference_type)
    VALUES (p_customer_id, -p_amount, p_type, p_description, p_reference_id, p_reference_type);
END;
$$;

-- Estornar moedas (refund on cancel)
CREATE OR REPLACE FUNCTION refund_coins(
    p_customer_id  UUID,
    p_amount       INTEGER,
    p_reference_id UUID DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE coin_balances
    SET balance       = balance + p_amount,
        lifetime_spent = GREATEST(0, lifetime_spent - p_amount),
        updated_at    = now()
    WHERE customer_id = p_customer_id;

    INSERT INTO coin_transactions(customer_id, amount, type, description, reference_id, reference_type)
    VALUES (p_customer_id, p_amount, 'refund_cancel',
            'Estorno por cancelamento de compra', p_reference_id, 'sale');
END;
$$;
