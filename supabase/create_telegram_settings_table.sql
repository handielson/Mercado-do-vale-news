-- Tabela de configurações da integração com o Telegram
CREATE TABLE IF NOT EXISTS telegram_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_token TEXT,
    chat_id TEXT,
    active BOOLEAN DEFAULT false,
    sale_message_template TEXT DEFAULT '🛒 *Nova Venda Registrada!*\n\n👤 *Cliente:* {cliente}\n📱 *Produto:* {produto}\n💰 *Valor:* {valor}\n\n📦 *Estoque de {modelo}:* {estoque} unidade(s)',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE telegram_settings ENABLE ROW LEVEL SECURITY;

-- Remover policies existentes para evitar erro em reexecuções
DROP POLICY IF EXISTS "authenticated_all" ON telegram_settings;

-- Apenas usuários autenticados (staff/admin) acessam as configurações do bot
CREATE POLICY "authenticated_all" ON telegram_settings
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Inserir o registro único global com ID fixo caso a tabela esteja vazia
INSERT INTO telegram_settings (id, active)
SELECT '00000000-0000-0000-0000-000000000001', false
WHERE NOT EXISTS (SELECT 1 FROM telegram_settings LIMIT 1);
