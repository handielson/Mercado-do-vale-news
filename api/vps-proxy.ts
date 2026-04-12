import type { IncomingMessage } from 'http';

const VPS_BASE_URL = process.env.VPS_BASE_URL || process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const VPS_SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';

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

export default async function handler(req: any, res: any) {
    const method = req.method || 'GET';
    const path = normalizePath(req.query?.path);

    if (!path) {
        return res.status(400).json({ error: 'Missing or invalid query param: path' });
    }

    if (!VPS_SYNC_KEY) {
        return res.status(500).json({ error: 'VPS_SYNC_KEY not configured on server' });
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
