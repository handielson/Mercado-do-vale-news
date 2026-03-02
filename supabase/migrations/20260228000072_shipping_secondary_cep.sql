-- Migration: adiciona secondary_origin_cep na tabela shipping_settings
-- Permite que o admin salve um segundo CEP de origem (ex: depósito externo)

ALTER TABLE shipping_settings
ADD COLUMN IF NOT EXISTS secondary_origin_cep TEXT DEFAULT NULL;

-- Verificação
SELECT id, origin_cep, secondary_origin_cep FROM shipping_settings LIMIT 1;
