-- Adiciona campos para dados financeiros/pagamento do membro da equipe
-- Usado principalmente para pagamento de entregadores (Freelancer/PJ)

ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS pix_key_type VARCHAR(20),  -- 'cpf', 'phone', 'email', 'random'
    ADD COLUMN IF NOT EXISTS pix_key     VARCHAR(255);

COMMENT ON COLUMN team_members.pix_key_type IS 'Tipo da chave PIX: cpf, phone, email, random';
COMMENT ON COLUMN team_members.pix_key     IS 'Chave PIX para pagamento';
