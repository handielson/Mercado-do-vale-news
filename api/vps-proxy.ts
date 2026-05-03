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

    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
}

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
