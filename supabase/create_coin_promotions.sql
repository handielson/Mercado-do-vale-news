-- ============================================================
-- PROMOÇÕES DE MOEDAS DO VALE
-- Bônus de moedas por produto ou categoria específica
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_promotions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,                      -- Ex: "Compre Xiaomi 15 e ganhe 100 moedas"
    description     TEXT,
    -- Trigger: pelo menos um dos campos abaixo define a regra
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,    -- produto específico
    category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,  -- ou qualquer produto da categoria
    min_purchase    NUMERIC(10,2) NOT NULL DEFAULT 0,   -- valor mínimo do pedido (0 = sem mínimo)
    -- Recompensa
    bonus_coins     INTEGER NOT NULL CHECK (bonus_coins > 0),
    -- Validade
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,                        -- NULL = sem expiração
    -- Limite de usos
    max_uses        INTEGER,                            -- NULL = ilimitado
    uses_count      INTEGER NOT NULL DEFAULT 0,
    -- Status
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Pelo menos produto OU categoria devem ser definidos (ou ambos nulos = promoção geral por valor)
    CONSTRAINT valid_trigger CHECK (
        product_id IS NOT NULL OR category_id IS NOT NULL OR min_purchase > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_coin_promo_product  ON coin_promotions(product_id)  WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coin_promo_category ON coin_promotions(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coin_promo_active   ON coin_promotions(active, expires_at);

-- RLS
ALTER TABLE coin_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coin_promo_admin" ON coin_promotions;
DROP POLICY IF EXISTS "coin_promo_public_read" ON coin_promotions;

CREATE POLICY "coin_promo_admin" ON coin_promotions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "coin_promo_public_read" ON coin_promotions
    FOR SELECT TO anon USING (active = true AND (expires_at IS NULL OR expires_at > now()));

-- RPC atômica para incrementar usos
CREATE OR REPLACE FUNCTION increment_coin_promo_uses(promo_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE coin_promotions SET uses_count = uses_count + 1 WHERE id = promo_id;
END;
$$;
