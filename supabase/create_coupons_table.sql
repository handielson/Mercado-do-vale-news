-- Tabela de cupons de desconto
CREATE TABLE IF NOT EXISTS coupons (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT        NOT NULL UNIQUE,
    description TEXT,
    type        TEXT        NOT NULL CHECK (type IN ('percent', 'fixed')),
    value       NUMERIC(10,2) NOT NULL CHECK (value > 0),
    min_order   NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_uses    INTEGER     DEFAULT NULL,         -- NULL = ilimitado
    uses_count  INTEGER     NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ DEFAULT NULL,         -- NULL = sem expiração
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    target_type TEXT        NOT NULL DEFAULT 'all'
        CHECK (target_type IN ('all', 'varejo', 'atacado', 'revenda', 'ADMIN')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para busca por código (case-insensitive)
CREATE INDEX IF NOT EXISTS coupons_code_idx ON coupons (UPPER(code));

-- RLS: apenas usuários autenticados (admins) acessam
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Admins podem ler e escrever
CREATE POLICY "authenticated_all" ON coupons
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Anon pode apenas ler cupons ativos (para validação no catálogo público)
CREATE POLICY "anon_read_active" ON coupons
    FOR SELECT
    TO anon
    USING (active = TRUE);
