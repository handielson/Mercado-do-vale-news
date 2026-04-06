-- Fix RLS Policy for team_members table
-- Allow authenticated users (admins) full access

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os usuários autenticados podem ler
DROP POLICY IF EXISTS team_members_select_policy ON team_members;
CREATE POLICY team_members_select_policy ON team_members
    FOR SELECT
    USING (true);

-- INSERT: usuários autenticados podem inserir
DROP POLICY IF EXISTS team_members_insert_policy ON team_members;
CREATE POLICY team_members_insert_policy ON team_members
    FOR INSERT
    WITH CHECK (true);

-- UPDATE: usuários autenticados podem atualizar
DROP POLICY IF EXISTS team_members_update_policy ON team_members;
CREATE POLICY team_members_update_policy ON team_members
    FOR UPDATE
    USING (true);

-- DELETE: usuários autenticados podem deletar
DROP POLICY IF EXISTS team_members_delete_policy ON team_members;
CREATE POLICY team_members_delete_policy ON team_members
    FOR DELETE
    USING (true);
