-- Migration: adiciona secondary_origin_label na tabela shipping_settings
-- Complementa o secondary_origin_cep já existente com um label legível (ex: 'Juazeiro')

ALTER TABLE shipping_settings
    ADD COLUMN IF NOT EXISTS secondary_origin_label TEXT DEFAULT NULL;

COMMENT ON COLUMN shipping_settings.secondary_origin_label IS 'Label do segundo depósito de origem (ex: Juazeiro, Filial PE)';

-- Também adiciona origin_label se não existir (label do CEP primário)
ALTER TABLE shipping_settings
    ADD COLUMN IF NOT EXISTS origin_label TEXT DEFAULT NULL;

COMMENT ON COLUMN shipping_settings.origin_label IS 'Label do depósito principal (ex: Petrolina, Loja Principal)';

-- Verificação
SELECT id, origin_cep, origin_label, secondary_origin_cep, secondary_origin_label FROM shipping_settings LIMIT 1;
