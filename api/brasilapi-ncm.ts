import type { VercelRequest, VercelResponse } from '@vercel/node';

const BRASILAPI_NCM_URL = 'https://brasilapi.com.br/api/ncm/v1';

function getSearchParam(value: unknown): string {
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const search = getSearchParam(req.query.search);
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
