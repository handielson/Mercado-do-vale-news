-- ============================================================
-- SHIPPING SYSTEM MIGRATION v2
-- Sistema de Frete Dinâmico - Mercado do Vale (single-tenant)
-- SEM company_id — mais simples, sem dep. de RLS da tabela company
-- ============================================================

-- Remover tabelas antigas se existirem
DROP TABLE IF EXISTS shipping_price_ranges;
DROP TABLE IF EXISTS shipping_zones;
DROP TABLE IF EXISTS shipping_settings;

-- 1. Configurações globais de frete
CREATE TABLE IF NOT EXISTS shipping_settings (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_cep              text NOT NULL DEFAULT '',
    melhor_envio_token      text,
    melhor_envio_sandbox    boolean NOT NULL DEFAULT true,
    melhor_envio_enabled    boolean NOT NULL DEFAULT false,
    local_delivery_enabled  boolean NOT NULL DEFAULT true,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- 2. Zonas de entrega
CREATE TABLE IF NOT EXISTS shipping_zones (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    type                text NOT NULL CHECK (type IN ('local_free', 'local_paid', 'national')),
    enabled             boolean NOT NULL DEFAULT true,
    cities              text[] NOT NULL DEFAULT '{}',
    cep_ranges          text[] NOT NULL DEFAULT '{}',
    max_km_free         numeric,
    price_per_km        numeric,
    fixed_price         numeric,
    min_order_free      numeric,
    estimated_days_min  int NOT NULL DEFAULT 0,
    estimated_days_max  int NOT NULL DEFAULT 1,
    display_order       int NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- 3. Faixas de preço por distância
CREATE TABLE IF NOT EXISTS shipping_price_ranges (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id             uuid NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
    label               text NOT NULL,
    min_km              numeric NOT NULL DEFAULT 0,
    max_km              numeric,
    price               numeric NOT NULL DEFAULT 0,
    estimated_days_min  int NOT NULL DEFAULT 0,
    estimated_days_max  int NOT NULL DEFAULT 1
);

-- RLS
ALTER TABLE shipping_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_price_ranges ENABLE ROW LEVEL SECURITY;

-- Policies: acesso público de leitura (catálogo precisa calcular frete)
-- Escrita apenas para usuários autenticados
CREATE POLICY "public_read_shipping_settings" ON shipping_settings
    FOR SELECT USING (true);
CREATE POLICY "auth_write_shipping_settings" ON shipping_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "public_read_shipping_zones" ON shipping_zones
    FOR SELECT USING (true);
CREATE POLICY "auth_write_shipping_zones" ON shipping_zones
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "public_read_shipping_price_ranges" ON shipping_price_ranges
    FOR SELECT USING (true);
CREATE POLICY "auth_write_shipping_price_ranges" ON shipping_price_ranges
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: inserir row de settings vazia para evitar 404
INSERT INTO shipping_settings (origin_cep, local_delivery_enabled)
VALUES ('', true)
ON CONFLICT DO NOTHING;

-- Zonas padrão Petrolina / Juazeiro
INSERT INTO shipping_zones (name, type, cities, max_km_free, estimated_days_min, estimated_days_max, display_order)
VALUES
  ('Petrolina - Frete Grátis', 'local_free', ARRAY['Petrolina'], 15, 0, 0, 1),
  ('Juazeiro - Frete Grátis',  'local_free', ARRAY['Juazeiro'],  15, 0, 0, 2);
