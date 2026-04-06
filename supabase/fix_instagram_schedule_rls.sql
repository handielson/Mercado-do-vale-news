-- Fix: permitir SELECT público na instagram_schedule para o cron conseguir ler
-- (a tabela só tem conteúdo de agendamento, sem dados sensíveis de clientes)

DROP POLICY IF EXISTS "Anon can read active instagram_schedule" ON instagram_schedule;
CREATE POLICY "Anon can read active instagram_schedule"
    ON instagram_schedule
    FOR SELECT
    TO anon
    USING (active = true);

DROP POLICY IF EXISTS "Service role full access instagram_schedule" ON instagram_schedule;
CREATE POLICY "Service role full access instagram_schedule"
    ON instagram_schedule
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

