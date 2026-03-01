-- Adiciona campo de nome da instituição bancária ao membro da equipe
ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);

COMMENT ON COLUMN team_members.bank_name IS 'Nome da instituição bancária (ex: Nubank, Bradesco)';
