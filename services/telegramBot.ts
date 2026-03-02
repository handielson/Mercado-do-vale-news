import { telegramSettingsService } from './telegramSettings';

export interface SaleNotificationData {
    id_venda: string;
    cliente: string;
    telefone: string;
    produto: string;
    modelo: string;
    valor: string;
    lucro: string;
    pagamento: string;
    desconto: string;
    estoque: string;
    entregador: string;  // Nome do entregador ou 'Retirada na Loja'
    entregador_pix: string; // Chave PIX do entregador ou '-'
}

export interface CustomerNotificationData {
    nome_cliente: string;
    telefone_cliente: string;
    tipo_cliente: string;
}

export const telegramBotService = {

    // Função para processar o template e enviar a requisição de forma assíncrona ("fire and forget").
    // Retorna imediatamente sem travar o PDV.
    notifySale(data: SaleNotificationData) {
        // Um pequeno delay de 50ms para tirar a concorrência da thread principal e deixar a página de PDV renderizar o fim da compra suavemente.
        setTimeout(() => {
            this._processAndSend('sale_template', 'sale', data).catch(err => {
                console.error('[Telegram Bot] Falha silenciosa no envio do alerta de venda:', err);
            });
        }, 50);
    },

    notifyNewCustomer(data: CustomerNotificationData) {
        setTimeout(() => {
            this._processAndSend('new_customer_template', 'new_customer', data).catch(err => {
                console.error('[Telegram Bot] Falha silenciosa no envio do alerta de novo cliente:', err);
            });
        }, 50);
    },

    async _processAndSend(templateId: string, actionType: string, data: any): Promise<void> {
        try {
            // 1. Obter configurações
            const settings = await telegramSettingsService.getSettings();

            // 2. Validações primitivas (Bot está ativo? Tem token e chat_id?)
            if (!settings.active || !settings.bot_token || !settings.chat_id) {
                return;
            }

            // 3. Buscar os templates que correspondem ao Id (prioritário) ou ao tipo de ação
            let template = settings.templates?.find(t => t.id === templateId) ||
                settings.templates?.find(t => t.action_type === actionType && t.type === 'action');

            if (!template) return;

            // 4. Substituir TAGs dinâmicas baseadas no objeto `data` passado
            let message = template.content;
            Object.keys(data).forEach(key => {
                const regex = new RegExp(`\\{${key}\\}`, 'g');
                message = message.replace(regex, data[key] ?? '');
            });

            // 5. Disparo usando fetch e bot API do telegram
            await this.sendMessage(settings.bot_token, settings.chat_id, message);
        } catch (error) {
            console.error('Erro silencioso ao enviar notificação Telegram:', error);
            // Non-blocking error
        }
    },

    async sendMessage(token: string, chatId: string, text: string) {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown' // Permite enviar negrito (*bold*), itálico (_italic_)
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Telegram API Error: ${errorData.description || response.statusText}`);
        }
    },

    // Teste de conexão/mensagem invocado a partir da tela de admin
    async sendTestMessage(token: string, chatId: string): Promise<boolean> {
        try {
            await this.sendMessage(token, chatId, '🤖 *Teste de Integração*\n\nSeu bot está configurado com sucesso no *Mercado do Vale*! ✅');
            return true;
        } catch (err) {
            console.error('Falha ao enviar teste:', err);
            return false;
        }
    }
};
