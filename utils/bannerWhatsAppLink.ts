import { buildWhatsAppUrl } from '../services/welcomeMessageService';

export function parseBannerWhatsAppLink(value?: string) {
    try {
        const url = new URL(value || '');
        if (url.protocol !== 'https:') return null;
        const phone = url.hostname === 'wa.me'
            ? url.pathname.slice(1)
            : url.hostname === 'api.whatsapp.com' && url.pathname === '/send'
                ? url.searchParams.get('phone') || '' : '';
        if (!/^\d{10,15}$/.test(phone)) return null;
        return { phone, message: url.searchParams.get('text') || '' };
    } catch { return null; }
}

export function getBannerWhatsAppLink(phone: string, message: string): string {
    const digits = phone.replace(/\D/g, '');
    // Números locais podem começar com DDD 55; o comprimento distingue o país.
    const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
    if (!/^55\d{10,11}$/.test(number) || !message.trim()) return '';
    return buildWhatsAppUrl(number, message.trim());
}
