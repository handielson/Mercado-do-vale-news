import { vpsClient } from './vpsClient';

export interface TelegramTemplate {
    id: string; // Ex: 'sale_template', 'custom_123'
    name: string; // Ex: 'Venda Padrão (PDV)'
    content: string; // O corpo da mensagem
    type: 'action' | 'scheduled';
    action_type?: 'sale' | 'new_customer' | 'online_order' | 'online_order_paid' | null;
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
        id: 'online_order_template',
        name: 'Pedido Online',
        type: 'action',
        action_type: 'online_order',
        content: '🛒 *Novo Pedido Online!* (#{id_pedido})\n\n👤 *Cliente:* {cliente}\n📞 *Telefone:* {telefone}\n\n📦 *Itens:*\n{itens}\n💰 *Total:* {valor}\n💳 *Pagamento:* {pagamento}\n🚚 *Entrega:* {entrega}\n📍 *Endereço:* {endereco}'
    },
    {
        id: 'online_order_paid_template',
        name: 'Pedido Pago (Tempo Real)',
        type: 'action',
        action_type: 'online_order_paid',
        content: '✅ *Pedido Pago Confirmado!* (#{id_pedido})\n\n👤 *Cliente:* {cliente}\n📞 *Telefone:* {telefone}\n📧 *Email:* {email}\n\n📦 *Itens:*\n{itens}\n\n💸 *Preço de Compra:* {preco_compra}\n💰 *Preço de Venda:* {preco_venda}\n📈 *Lucro:* {lucro}\n\n💳 *Pagamento:* {pagamento}\n🚚 *Entrega:* {entrega}\n📍 *Endereço:* {endereco}\n🕒 *Pago em:* {data_pagamento}\n🔎 *Pedido completo:* {id_pedido_completo}'
    },
    {
        id: 'daily_report_template',
        name: 'Fechamento Diário',
        type: 'scheduled',
        schedule_time: '19:00',
        content: '📊 *Fechamento Diário de Vendas*\n📅 *Data:* {data}\n\n✅ *Vendas Hoje:* {qtd_vendas}\n💰 *Faturamento:* {faturamento}\n📈 *Lucro do Dia:* {lucro_total}\n\n📦 *ESTOQUE GERAL*\n📱 Aparelhos Disponíveis: {estoque_celulares}\n\n*Detalhado:*\n{estoque_lista_celulares}'
    }
];

const DEFAULT_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

interface TableDataResponse {
    rows?: TelegramSettings[];
}

function parseTemplates(value: unknown): TelegramTemplate[] {
    if (Array.isArray(value)) return value as TelegramTemplate[];

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}

function normalizeSettings(row?: Partial<TelegramSettings> | null): TelegramSettings {
    const data: TelegramSettings = {
        id: row?.id || DEFAULT_SETTINGS_ID,
        bot_token: row?.bot_token ?? null,
        chat_id: row?.chat_id ?? null,
        active: Boolean(row?.active),
        templates: parseTemplates(row?.templates),
        updated_at: row?.updated_at || new Date().toISOString()
    };

    // Se a coluna templates acabou de ser criada, ou esta vazia, forcamos o default
    if (!data.templates || !Array.isArray(data.templates) || data.templates.length === 0) {
        data.templates = DEFAULT_TEMPLATES;
    }

    // Compatibilidade reversa: se os templates antigos nao tem "type", atribuimos
    data.templates = data.templates.map((t: TelegramTemplate) => {
        if (!t.type) {
            return {
                ...t,
                type: t.id === 'sale_template' ? 'action' : 'action',
                action_type: t.id === 'sale_template' ? 'sale' : null
            };
        }
        return t;
    });

    // Injeta templates novos que ainda nao existem na base (merge nao-destrutivo)
    const existingIds = new Set(data.templates.map((t: TelegramTemplate) => t.id));
    const missingDefaults = DEFAULT_TEMPLATES.filter(t => !existingIds.has(t.id));
    if (missingDefaults.length > 0) {
        data.templates = [...data.templates, ...missingDefaults];
    }

    return data;
}

export const telegramSettingsService = {
    async getSettings(): Promise<TelegramSettings> {
        const data = await vpsClient.get<TableDataResponse>('/table-data/telegram_settings?limit=1&offset=0');
        return normalizeSettings(data.rows?.[0]);
    },

    async updateSettings(updates: Partial<TelegramSettings>): Promise<TelegramSettings> {
        const current = await this.getSettings();

        // Assegurar que o ID existe
        const payload = {
            ...updates,
            id: current.id,
            updated_at: new Date().toISOString()
        };

        if (current.id && current.id !== DEFAULT_SETTINGS_ID) {
            const data = await vpsClient.patch<TelegramSettings>(
                `/table-data/telegram_settings/${encodeURIComponent(current.id)}?pk=id`,
                payload
            );
            return normalizeSettings(data);
        }

        const data = await vpsClient.post<TelegramSettings>('/table-data/telegram_settings', payload);
        return normalizeSettings(data);
    }
};
