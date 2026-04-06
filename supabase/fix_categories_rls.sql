-- Fix Categories RLS: permite UPDATE para usuários autenticados
-- Mesmo padrão aplicado às tabelas brands e products

-- 1. Garante que RLS está ativado na tabela
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 2. Remove policy de write antiga se existir (evita conflito)
DROP POLICY IF EXISTS categories_authenticated_write ON categories;

-- 3. Cria policy de escrita para autenticados (INSERT + UPDATE + DELETE)
CREATE POLICY categories_authenticated_write ON categories
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Verificação: lista policies ativas na tabela
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'categories';
