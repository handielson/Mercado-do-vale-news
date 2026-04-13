const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PROXIED_MEDIA_HOSTNAMES = new Set([
    'api.xiaomipetrolina.com.br',
    'imagens.xiaomipetrolina.com.br',
]);

export const toBrowserSafeMediaUrl = (rawUrl?: string | null): string => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;

    try {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const parsed = new URL(rawUrl, origin);
        const isAbsolute = /^https?:\/\//i.test(rawUrl);
        if (!isAbsolute) return rawUrl;

        if (typeof window === 'undefined') return rawUrl;
        if (!LOCAL_HOSTNAMES.has(window.location.hostname)) return rawUrl;
        if (!PROXIED_MEDIA_HOSTNAMES.has(parsed.hostname)) return rawUrl;

        const proxiedPath = `${parsed.pathname}${parsed.search || ''}`;
        return `/vps-proxy?path=${encodeURIComponent(proxiedPath)}`;
    } catch {
        return rawUrl;
    }
};
