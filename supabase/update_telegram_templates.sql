-- Adiciona a coluna templates (JSONB) para guardar até 10 modelos de notificação diferentes
ALTER TABLE telegram_settings 
ADD COLUMN IF NOT EXISTS templates JSONB DEFAULT '[]'::jsonb;

-- (Opcional) Migrar o template de venda antigo para o novo formato de array, 
-- caso o usuário já tenha configurado e não queira perder
UPDATE telegram_settings 
SET templates = jsonb_build_array(
    jsonb_build_object(
        'id', 'sale_template',
        'name', 'Venda Padrão (PDV)',
        'content', COALESCE(sale_message_template, '🛒 *Nova Venda Registrada!* (#{id_venda})\n\n👤 *Cliente:* {cliente}\n📱 *Produto:* {produto}\n💳 *Pagamento:* {pagamento} ({desconto} desc.)\n💰 *Valor Pago:* {valor}\n📈 *Lucro Estimado:* {lucro}\n\n📦 *Estoque de {modelo}:* {estoque} unidade(s)')
    )
)
WHERE templates = '[]'::jsonb OR templates IS NULL;
