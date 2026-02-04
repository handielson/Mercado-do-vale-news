/**
 * Gera URL completa com domínio
 */
export const getFullUrl = (path: string): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${path}`;
};

/**
 * Adiciona parâmetros à URL existente
 */
export const addUrlParams = (url: string, params: Record<string, string>): string => {
    const urlObj = new URL(url, window.location.origin);

    Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.set(key, value);
    });

    return urlObj.toString();
};

/**
 * Gera slug amigável a partir de texto
 */
export const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-') // Substitui espaços por hífens
        .replace(/-+/g, '-') // Remove hífens duplicados
        .trim();
};

/**
 * Obtém todos os parâmetros da URL atual
 */
export const getCurrentUrlParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(window.location.search);

    searchParams.forEach((value, key) => {
        params[key] = value;
    });

    return params;
};

/**
 * Cria URL de compartilhamento para WhatsApp
 */
export const getWhatsAppShareUrl = (url: string, text?: string): string => {
    const message = text ? `${text} ${url}` : url;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
};

/**
 * Cria URL de compartilhamento para Facebook
 */
export const getFacebookShareUrl = (url: string): string => {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
};

/**
 * Cria URL de compartilhamento para Twitter
 */
export const getTwitterShareUrl = (url: string, text?: string): string => {
    const params = new URLSearchParams({
        url: url,
        ...(text && { text })
    });
    return `https://twitter.com/intent/tweet?${params.toString()}`;
};

/**
 * Cria URL de compartilhamento para Email
 */
export const getEmailShareUrl = (url: string, subject?: string, body?: string): string => {
    const params = new URLSearchParams({
        ...(subject && { subject }),
        body: body ? `${body}\n\n${url}` : url
    });
    return `mailto:?${params.toString()}`;
};
