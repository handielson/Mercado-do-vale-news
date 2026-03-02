-- Adiciona campos de promoção temporária na tabela products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_promo INTEGER,        -- Preço promocional (centavos)
ADD COLUMN IF NOT EXISTS promo_start TIMESTAMPTZ,    -- Início da promoção
ADD COLUMN IF NOT EXISTS promo_end TIMESTAMPTZ;      -- Fim da promoção

COMMENT ON COLUMN products.price_promo IS 'Preço promocional temporário em centavos. NULL = sem promoção.';
COMMENT ON COLUMN products.promo_start IS 'Data/hora de início da promoção.';
COMMENT ON COLUMN products.promo_end IS 'Data/hora de encerramento da promoção.';

-- Índice para encontrar produtos em promoção ativa rapidamente
CREATE INDEX IF NOT EXISTS idx_products_promo_active 
ON products(promo_start, promo_end) 
WHERE price_promo IS NOT NULL;
