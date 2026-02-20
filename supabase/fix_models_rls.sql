-- Fix Models RLS: permite INSERT/UPDATE/DELETE para usuários autenticados
-- Mesmo padrão aplicado às tabelas brands, products e categories

-- 1. Garante que RLS está ativado na tabela
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- 2. Remove policy de write antiga se existir (evita conflito)
DROP POLICY IF EXISTS models_authenticated_write ON models;

-- 3. Cria policy de escrita para autenticados (INSERT + UPDATE + DELETE)
CREATE POLICY models_authenticated_write ON models
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Verificação: lista policies ativas na tabela
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'models';
