-- Fase 8: Modo de Operação Segura (Manutenção Integrada)
-- Tabela Afetada: company_settings

-- 1. Cria a coluna que dita se a loja pública está no ar (false) ou em manutenção (true)
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT false;

-- 2. Cria a coluna pra armazenar a mensagem que os clientes enxergarão
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT;

-- 3. Cria a coluna pra armazenar a senha da URL de Bypass (ex: mercadodovale.com.br?admin=SENHAAQUI)
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS maintenance_bypass_key TEXT;

-- Atualiza cache do PostgREST
NOTIFY pgrst, 'reload schema';
