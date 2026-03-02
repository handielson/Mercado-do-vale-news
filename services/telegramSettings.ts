import { supabase } from './supabase';

export interface TelegramTemplate {
    id: string; // Ex: 'sale_template', 'custom_123'
    name: string; // Ex: 'Venda Padrão (PDV)'
    content: string; // O corpo da mensagem
    type: 'action' | 'scheduled';
    action_type?: 'sale' | 'new_customer' | null;
    schedule_time?: string | null; // HH:MM format like '19:00'
}

export interface TelegramSettings {
    id: string;
    bot_token: string | null;
    chat_id: string | null;
    active: boolean;
    templates: TelegramTemplate[];
    updated_at: string;
}

const DEFAULT_TEMPLATES: TelegramTemplate[] = [
    {
        id: 'sale_template',
        name: 'Venda Padrão (PDV)',
        type: 'action',
        action_type: 'sale',
        content: '🛒 *Nova Venda Registrada!* (#{id_venda})\n\n👤 *Cliente:* {cliente}\n📱 *Produto:* {produto}\n💳 *Pagamento:* {pagamento} ({desconto} desc.)\n💰 *Valor Pago:* {valor}\n📈 *Lucro Estimado:* {lucro}\n\n🚚 *Entrega:* {entregador}\n💠 *PIX Entregador:* {entregador_pix}\n\n📦 *Estoque de {modelo}:* {estoque} unidade(s)'
    },
    {
        id: 'new_customer_template',
        name: 'Cliente Cadastrado',
        type: 'action',
        action_type: 'new_customer',
        content: '🎉 *Novo Cliente Registrado!*\n\n👤 *Nome:* {nome_cliente}\n📞 *Telefone:* {telefone_cliente}\n🏷️ *Tipo:* {tipo_cliente}'
    },
    {
        id: 'daily_report_template',
        name: 'Fechamento Diário',
        type: 'scheduled',
        schedule_time: '19:00',
        content: '📊 *Fechamento Diário de Vendas*\n📅 *Data:* {data}\n\n✅ *Vendas Hoje:* {qtd_vendas}\n💰 *Faturamento:* {faturamento}\n📈 *Lucro do Dia:* {lucro_total}\n\n📦 *ESTOQUE GERAL*\n📱 Aparelhos Disponíveis: {estoque_celulares}\n\n*Detalhado:*\n{estoque_lista_celulares}'
    }
];

export const telegramSettingsService = {
    async getSettings(): Promise<TelegramSettings> {
        const { data, error } = await supabase
            .from('telegram_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Tabela vazia ou RLS impedindo a leitura
                return {
                    id: '00000000-0000-0000-0000-000000000001',
                    bot_token: null,
                    chat_id: null,
                    active: false,
                    templates: DEFAULT_TEMPLATES,
                    updated_at: new Date().toISOString()
                };
            }
            throw error;
        }

        // Se a coluna templates acabou de ser criada, ou está vazia, forçamos o default
        if (!data.templates || !Array.isArray(data.templates) || data.templates.length === 0) {
            data.templates = DEFAULT_TEMPLATES;
        }

        // Compatibilidade reversa: se os templates antigos não tem "type", atribuimos
        data.templates = data.templates.map((t: TelegramTemplate) => {
            if (!t.type) {
                return {
                    ...t,
                    type: t.id === 'sale_template' ? 'action' : 'action', // Default to 'action' for old templates
                    action_type: t.id === 'sale_template' ? 'sale' : null
                };
            }
            return t;
        });

        return data;
    },

    async updateSettings(updates: Partial<TelegramSettings>): Promise<TelegramSettings> {
        const current = await this.getSettings();

        // Assegurar que o ID existe
        const payload = {
            ...updates,
            id: current.id,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('telegram_settings')
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
