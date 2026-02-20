import { supabase } from './supabase';
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
📋 Regulamento completo: {link}moedas-do-vale`;


const PORTAL_LINK = 'https://mv.mercadodovale.com.br/';

/**
 * Extracts the default password from CPF: first 5 digits (no punctuation).
 * Ex: "123.456.789-00" → "12345"
 */
export function getDefaultPassword(cpf_cnpj: string): string {
    const digits = cpf_cnpj.replace(/\D/g, '');
    return digits.slice(0, 5);
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

    return template
        .replace(/\{nome\}/g, customer.name)
        .replace(/\{cpf\}/g, cpfMasked)
        .replace(/\{senha\}/g, senha)
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
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return DEFAULT_TEMPLATE;

            const { data, error } = await supabase
                .from('catalog_settings')
                .select('welcome_message_template')
                .eq('user_id', user.id)
                .single();

            if (error || !data?.welcome_message_template) return DEFAULT_TEMPLATE;
            return data.welcome_message_template;
        } catch {
            return DEFAULT_TEMPLATE;
        }
    }

    async saveTemplate(template: string): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { error } = await supabase
            .from('catalog_settings')
            .upsert(
                { user_id: user.id, welcome_message_template: template, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            );

        if (error) throw error;
    }

    getDefaultTemplate(): string {
        return DEFAULT_TEMPLATE;
    }
}

export const welcomeMessageService = new WelcomeMessageService();
