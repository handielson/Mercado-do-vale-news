const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PROXIED_MEDIA_HOSTNAMES = new Set([
    'api.xiaomipetrolina.com.br',
    'imagens.xiaomipetrolina.com.br',
]);

const AWS_SIGNED_QUERY_KEYS = [
    'AWSAccessKeyId',
    'Signature',
    'X-Amz-Algorithm',
    'X-Amz-Credential',
    'X-Amz-Signature',
];

const parseAmzDate = (rawValue: string): number | null => {
    const match = rawValue.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i,
    );

    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    return Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
    );
};

export const getSignedMediaExpiryMs = (rawUrl?: string | null): number | null => {
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return null;

    try {
        const parsed = new URL(rawUrl);
        const hasAwsSignature = AWS_SIGNED_QUERY_KEYS.some((key) => parsed.searchParams.has(key));
        if (!hasAwsSignature) return null;

        const expiresParam = parsed.searchParams.get('Expires');
        if (expiresParam && /^\d+$/.test(expiresParam)) {
            return Number(expiresParam) * 1000;
        }

        const amzDate = parsed.searchParams.get('X-Amz-Date');
        const amzExpires = parsed.searchParams.get('X-Amz-Expires');
        if (amzDate && amzExpires && /^\d+$/.test(amzExpires)) {
            const issuedAt = parseAmzDate(amzDate);
            if (issuedAt !== null) {
                return issuedAt + Number(amzExpires) * 1000;
            }
        }

        return null;
    } catch {
        return null;
    }
};

export const isExpiredSignedMediaUrl = (
    rawUrl?: string | null,
    now: number = Date.now(),
): boolean => {
    const expiresAt = getSignedMediaExpiryMs(rawUrl);
    return expiresAt !== null && expiresAt <= now;
};

export const hasRenderableMediaUrl = (
    rawUrl?: string | null,
    now: number = Date.now(),
): boolean => {
    if (!rawUrl || !rawUrl.trim()) return false;
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return true;
    return !isExpiredSignedMediaUrl(rawUrl, now);
};

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
