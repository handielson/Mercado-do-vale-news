import type { IncomingMessage } from 'http';
import { createClient } from '@supabase/supabase-js';

const VPS_API_HTTP_BASE_URL = 'http://api.xiaomipetrolina.com.br';
const VPS_API_HTTPS_BASE_URL = 'https://api.xiaomipetrolina.com.br';
const DEFAULT_VPS_BASE_URL = VPS_API_HTTPS_BASE_URL;
const CONFIGURED_VPS_BASE_URL = normalizeVpsProxyBaseUrl(
    process.env.VPS_BASE_URL || process.env.VITE_VPS_BASE_URL || DEFAULT_VPS_BASE_URL,
);
const VPS_SYNC_KEY = process.env.VPS_SYNC_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const READ_TIMEOUT_MS = Number(process.env.VPS_PROXY_READ_TIMEOUT_MS || 7000);
const WRITE_TIMEOUT_MS = Number(process.env.VPS_PROXY_WRITE_TIMEOUT_MS || 15000);
const BRASILAPI_NCM_URL = 'https://brasilapi.com.br/api/ncm/v1';

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

function normalizePath(input: unknown): string {
    const path = String(input || '').trim();
    if (!path) return '';
    if (!path.startsWith('/')) return '';
    return path;
}

function getFirstQueryParam(value: unknown): string {
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
}

async function handleBrasilapiNcm(req: any, res: any) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const search = getFirstQueryParam(req.query?.search);
    if (!search || search.length < 2) {
        return res.status(400).json({ error: 'Missing or invalid search parameter' });
    }

    try {
        const upstream = await fetch(`${BRASILAPI_NCM_URL}?search=${encodeURIComponent(search)}`, {
            headers: { Accept: 'application/json' },
        });

        const body = await upstream.text();
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        return res.status(upstream.status).send(body);
    } catch (error) {
        console.error('[brasilapi-ncm] proxy error:', error);
        return res.status(502).json({ error: 'BrasilAPI unavailable' });
    }
}

export function normalizeVpsProxyBaseUrl(input: unknown): string {
    const baseUrl = String(input || DEFAULT_VPS_BASE_URL).trim().replace(/\/+$/, '');
    return baseUrl || DEFAULT_VPS_BASE_URL;
}

function getBearerToken(req: any): string | null {
    const auth = String(req.headers['authorization'] || '');
    if (!auth.toLowerCase().startsWith('bearer ')) return null;
    const token = auth.slice(7).trim();
    return token || null;
}

async function getAuthContext(req: any): Promise<{ userId: string | null; customerId: string | null; isAdmin: boolean }> {
    if (!supabase) return { userId: null, customerId: null, isAdmin: false };
    const token = getBearerToken(req);
    if (!token) return { userId: null, customerId: null, isAdmin: false };

    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id || null;
    if (!userId) return { userId: null, customerId: null, isAdmin: false };

    const { data: customer } = await supabase
        .from('customers')
        .select('id, customer_type')
        .eq('user_id', userId)
        .single();

    return {
        userId,
        customerId: customer?.id || null,
        isAdmin: customer?.customer_type === 'ADMIN',
    };
}

function isSensitiveGetPath(path: string): boolean {
    return (
        path.startsWith('/company-settings') ||
        path.startsWith('/admin/') ||
        path.startsWith('/table-data/') ||
        // /synology/ GETs are protected by x-sync-key injected by this proxy — admin check is redundant
        // Writes (/synology/upload, DELETE /synology/file) are still blocked by isWrite check
        path.startsWith('/images/list')
    );
}

function isPublicProductReadPath(pathname: string): boolean {
    if (pathname === '/products' || pathname === '/products/category-counts') return true;
    if (/^\/products\/by-category\/[^/]+$/u.test(pathname)) return true;
    if (/^\/products\/by-(?:slug|ean)\/[^/]+$/u.test(pathname)) return true;
    if (/^\/products\/[^/]+\/combo$/u.test(pathname)) return true;
    return /^\/products\/[^/]+$/u.test(pathname);
}

export function isPublicProxyPath(path: string, method = 'GET'): boolean {
    const normalizedMethod = String(method || 'GET').trim().toUpperCase();
    const pathname = path.split('?')[0] || '/';

    if (normalizedMethod === 'POST' && /^\/banners\/[^/]+\/(?:click|view)$/u.test(pathname)) {
        return true;
    }

    if (normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
        return false;
    }

    if (
        pathname === '/banners' ||
        pathname === '/battery-healths' ||
        pathname === '/brands' ||
        pathname === '/catalog-settings' ||
        pathname === '/catalog/metadata' ||
        pathname === '/categories' ||
        pathname === '/check-video' ||
        pathname === '/field-presets' ||
        pathname === '/payment-fees' ||
        pathname === '/public/company-settings' ||
        pathname === '/public/check-video' ||
        pathname === '/rams' ||
        pathname === '/shipping/settings' ||
        pathname === '/shipping/zones' ||
        pathname === '/status' ||
        pathname === '/storages' ||
        pathname === '/versions' ||
        pathname === '/warranty-templates'
    ) {
        return true;
    }

    if (pathname.startsWith('/coupons/validate/')) return true;
    if (pathname.startsWith('/video/')) return true;
    if (/^\/versions\/[^/]+$/u.test(pathname)) return true;

    return isPublicProductReadPath(pathname);
}

export function getVpsProxyTargetBaseUrl(path: string, method = 'GET', baseUrl = CONFIGURED_VPS_BASE_URL): string {
    const normalizedBaseUrl = normalizeVpsProxyBaseUrl(baseUrl);

    if (isPublicProxyPath(path, method) && normalizedBaseUrl === VPS_API_HTTPS_BASE_URL) {
        return VPS_API_HTTP_BASE_URL;
    }

    return normalizedBaseUrl;
}

function extractFavoritesCustomerId(path: string): string | null {
    const m = path.match(/^\/customers\/([^/]+)\/favorites(?:\/[^/]+)?$/);
    return m?.[1] || null;
}

function getProxyTimeoutMs(method: string): number {
    return method === 'GET' || method === 'HEAD' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;
}

export default async function handler(req: any, res: any) {
    const method = req.method || 'GET';
    if (req.query?.brasilapi === 'ncm') {
        return handleBrasilapiNcm(req, res);
    }

    const path = normalizePath(req.query?.path);

    if (!path) {
        return res.status(400).json({ error: 'Missing or invalid query param: path' });
    }

    const auth = await getAuthContext(req);
    const isWrite = method !== 'GET' && method !== 'HEAD';
    const isPublicPath = isPublicProxyPath(path, method);
    const favoritesCustomerId = extractFavoritesCustomerId(path);
    const isFavoritesRoute = Boolean(favoritesCustomerId);
    const isCartSyncRoute = path === '/cart/sync';

    if (isFavoritesRoute) {
        if (!auth.userId) return res.status(401).json({ error: 'Auth required' });
        if (!auth.isAdmin && auth.customerId !== favoritesCustomerId) {
            return res.status(403).json({ error: 'Forbidden for this customer' });
        }
    } else if (isCartSyncRoute) {
        if (!auth.userId) return res.status(401).json({ error: 'Auth required' });
        const bodyCustomerId = req.body?.customerId ? String(req.body.customerId) : null;
        if (!auth.isAdmin && (!bodyCustomerId || auth.customerId !== bodyCustomerId)) {
            return res.status(403).json({ error: 'Forbidden for this customer' });
        }
    } else if (((isWrite && !isPublicPath) || isSensitiveGetPath(path)) && !auth.isAdmin) {
        return res.status(403).json({ error: 'Admin required' });
    }

    if (!isPublicPath && !VPS_SYNC_KEY) {
        return res.status(500).json({ error: 'VPS_SYNC_KEY not configured on server' });
    }

    const targetBaseUrl = getVpsProxyTargetBaseUrl(path, method);
    const target = `${targetBaseUrl}${path}`;

    try {
        const headers = new Headers();
        const contentType = req.headers['content-type'];
        if (contentType) headers.set('content-type', String(contentType));
        if (!isPublicPath) {
            headers.set('x-sync-key', VPS_SYNC_KEY);
        }
        headers.set('accept', String(req.headers['accept'] || 'application/json'));

        let body: BodyInit | undefined;
        if (method !== 'GET' && method !== 'HEAD') {
            if (req.body != null) {
                if (typeof req.body === 'string') {
                    body = req.body;
                } else if (Buffer.isBuffer(req.body)) {
                    body = new Uint8Array(req.body);
                } else {
                    body = JSON.stringify(req.body);
                    if (!headers.has('content-type')) {
                        headers.set('content-type', 'application/json');
                    }
                }
            } else {
                const raw = await readRawBody(req);
                if (raw.length > 0) body = new Uint8Array(raw);
            }
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), getProxyTimeoutMs(method));

        const upstream = await fetch(target, {
            method,
            headers,
            body,
            signal: controller.signal,
        }).finally(() => {
            clearTimeout(timeout);
        });

        res.status(upstream.status);
        const responseContentType = upstream.headers.get('content-type');
        if (responseContentType) res.setHeader('content-type', responseContentType);
        const cacheControl = upstream.headers.get('cache-control');
        if (cacheControl) res.setHeader('cache-control', cacheControl);

        const arrayBuffer = await upstream.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            return res.status(504).json({ error: 'Proxy request timed out', detail: `${method} ${path}` });
        }

        return res.status(502).json({ error: 'Proxy request failed', detail: String(error?.message || error) });
    }
}
