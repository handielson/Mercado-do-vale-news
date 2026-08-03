import { vpsApiService } from './vpsApiService';
import { Customer } from '../types/customer';

const DEFAULT_TEMPLATE = `Olá {nome}! Seja muito bem-vindo(a) ao Mercado do Vale. Agradecemos a preferência! Seu cadastro foi realizado com sucesso em nosso sistema.

🌐 Acesse seu Painel do Cliente:
Neste portal exclusivo você poderá:
🛒 Consultar todo seu histórico de compras
📄 Baixar/Reimprimir comprovantes
🛡 Acessar seus termos de garantia

🔗 Link de Acesso: {link}
(Selecione a opção Cliente)

🔑 Login (CPF): {cpf}
🔒 Senha: {senha}

🪙 *Moedas do Vale — Programa de Fidelidade*
Ao comprar conosco você acumula Moedas do Vale que podem ser trocadas por descontos reais! Faça check-in diário no aplicativo para ganhar ainda mais moedas.

🤝 *Ganhe ainda mais indicando amigos!*
Compartilhe nossas ofertas. Quando alguém comprar usando o seu código de indicação, você ganha Moedas do Vale automaticamente!
Seu Código de Indicação: *{codigo_indicacao}*

📋 Regulamento completo: {link}moedas-do-vale`;


const PORTAL_LINK = 'https://mv.mercadodovale.com.br/';

/**
 * Extracts the default password from CPF: first 6 digits (no punctuation).
 * Ex: "123.456.789-00" → "123456"
 */
export function getDefaultPassword(cpf_cnpj: string): string {
    const digits = cpf_cnpj.replace(/\D/g, '');
    return digits.slice(0, 6);
}

/**
 * Masks a CPF showing only the last 3 digits.
 * Ex: "123.456.789-00" → "***.***.** 9-00" → formats to "***.***.**9-00"
 * For CNPJs (14 digits) or invalid: returns as-is.
 */
export function maskCpf(cpf: string): string {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return cpf; // CNPJ or unknown — don't mask
    const masked = '*'.repeat(8) + digits.slice(8); // mask first 8 digits, keep last 3
    return `${masked.slice(0, 3)}.${masked.slice(3, 6)}.${masked.slice(6, 9)}-${masked.slice(9)}`;
}

/**
 * Substitutes template variables with customer data.
 */
export function buildMessage(template: string, customer: Customer): string {
    const cpfFormatted = customer.cpf_cnpj || '';
    const cpfMasked = maskCpf(cpfFormatted);
    const senha = customer.cpf_cnpj ? getDefaultPassword(customer.cpf_cnpj) : '*****';
    const codigoIndicacao = customer.referral_code || 'MV-XXXXX';

    return template
        .replace(/\{nome\}/g, customer.name)
        .replace(/\{cpf\}/g, cpfMasked)
        .replace(/\{senha\}/g, senha)
        .replace(/\{codigo_indicacao\}/g, codigoIndicacao)
        .replace(/\{link\}/g, PORTAL_LINK);
}

/**
 * Builds the wa.me URL with the message pre-filled.
 * Phone must be a Brazilian number (only digits).
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
    const digits = phone.replace(/\D/g, '');
    const number = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

class WelcomeMessageService {
    async getTemplate(): Promise<string> {
        try {
            const data = await vpsApiService.getCatalogSettings();
            if (!data?.welcome_message_template) return DEFAULT_TEMPLATE;
            return data.welcome_message_template;
        } catch {
            return DEFAULT_TEMPLATE;
        }
    }

    async saveTemplate(template: string): Promise<void> {
        const ok = await vpsApiService.syncCatalogSettings({ welcome_message_template: template });
        if (!ok) throw new Error('Erro ao salvar template de boas-vindas na VPS');
    }

    getDefaultTemplate(): string {
        return DEFAULT_TEMPLATE;
    }
}

export const welcomeMessageService = new WelcomeMessageService();
