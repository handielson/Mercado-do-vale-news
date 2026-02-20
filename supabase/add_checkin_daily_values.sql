-- ============================================================
-- Adicionar campo checkin_daily_values à cashback_settings
-- Sistema de progressão de moedas por streak semanal
-- ============================================================
-- Valores padrão: ciclo de 7 dias que aumenta progressivamente
-- Dia 1=5, Dia 2=10, Dia 3=15, Dia 4=20, Dia 5=25, Dia 6=30, Dia 7=50
-- No dia 8, reinicia do dia 1 (índice 0) e assim por diante

ALTER TABLE cashback_settings
    ADD COLUMN IF NOT EXISTS checkin_daily_values JSONB NOT NULL
        DEFAULT '[5, 10, 15, 20, 25, 30, 50]';

-- Atualizar a linha existente com o padrão caso ainda não tenha
UPDATE cashback_settings
SET checkin_daily_values = '[5, 10, 15, 20, 25, 30, 50]'
WHERE checkin_daily_values IS NULL;
