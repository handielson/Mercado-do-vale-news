-- =====================================================
-- REMOVER CONSTRAINT DE CHAVE ESTRANGEIRA
-- Permite uso de usuário mock em desenvolvimento
-- =====================================================

-- Remover a constraint de chave estrangeira user_id
ALTER TABLE company_settings 
DROP CONSTRAINT IF EXISTS company_settings_user_id_fkey;

-- IMPORTANTE: Esta mudança é apenas para desenvolvimento!
-- Em produção, você deve manter a constraint para garantir integridade dos dados.
