import type { IncomingMessage } from 'http';
import { createClient } from '@supabase/supabase-js';

const VPS_BASE_URL = process.env.VPS_BASE_URL || process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const VPS_SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

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
        path.startsWith('/synology/') ||
        path.startsWith('/images/list')
    );
}

function extractFavoritesCustomerId(path: string): string | null {
    const m = path.match(/^\/customers\/([^/]+)\/favorites(?:\/[^/]+)?$/);
    return m?.[1] || null;
}

export default async function handler(req: any, res: any) {
    const method = req.method || 'GET';
    const path = normalizePath(req.query?.path);

    if (!path) {
        return res.status(400).json({ error: 'Missing or invalid query param: path' });
    }

    if (!VPS_SYNC_KEY) {
        return res.status(500).json({ error: 'VPS_SYNC_KEY not configured on server' });
    }

    const auth = await getAuthContext(req);
    const isWrite = method !== 'GET' && method !== 'HEAD';
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
    } else if ((isWrite || isSensitiveGetPath(path)) && !auth.isAdmin) {
        return res.status(403).json({ error: 'Admin required' });
    }

    const target = `${VPS_BASE_URL}${path}`;

    try {
        const headers = new Headers();
        const contentType = req.headers['content-type'];
        if (contentType) headers.set('content-type', String(contentType));
        headers.set('x-sync-key', VPS_SYNC_KEY);
        headers.set('accept', String(req.headers['accept'] || 'application/json'));

        let body: BodyInit | undefined;
        if (method !== 'GET' && method !== 'HEAD') {
            if (req.body != null) {
                if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
                    body = req.body as BodyInit;
                } else {
                    body = JSON.stringify(req.body);
                    if (!headers.has('content-type')) {
                        headers.set('content-type', 'application/json');
                    }
                }
            } else {
                const raw = await readRawBody(req);
                if (raw.length > 0) body = raw;
            }
        }

        const upstream = await fetch(target, {
            method,
            headers,
            body,
        });

        res.status(upstream.status);
        const responseContentType = upstream.headers.get('content-type');
        if (responseContentType) res.setHeader('content-type', responseContentType);
        const cacheControl = upstream.headers.get('cache-control');
        if (cacheControl) res.setHeader('cache-control', cacheControl);

        const arrayBuffer = await upstream.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
        return res.status(502).json({ error: 'Proxy request failed', detail: String(error?.message || error) });
    }
}
