// Proxy serverless: busca produtos do Bling server-side (sem CORS)
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const page = req.query.page || 1;
    const search = req.query.search as string | undefined;

    const headers = { 'Authorization': authHeader, 'Accept': 'application/json' };
    const base = `https://www.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100&criterio=5`;

    try {
        if (!search) {
            // Sem filtro — busca paginada normal
            const r = await fetch(base, { headers });
            if (!r.ok) return res.status(r.status).json({ error: `Bling error: ${r.status}`, detail: await r.text() });
            return res.status(200).json(await r.json());
        }

        // Com filtro — busca por nome E por codigo (SKU) em paralelo e mescla
        const [byName, bySku] = await Promise.all([
            fetch(`${base}&nome=${encodeURIComponent(search)}`, { headers }),
            fetch(`${base}&codigo=${encodeURIComponent(search)}`, { headers }),
        ]);

        const nameData = byName.ok ? await byName.json() : { data: [] };
        const skuData = bySku.ok ? await bySku.json() : { data: [] };

        // Mescla deduplicando por id
        const seen = new Set<number>();
        const merged: any[] = [];
        for (const item of [...(nameData.data || []), ...(skuData.data || [])]) {
            if (!seen.has(item.id)) { seen.add(item.id); merged.push(item); }
        }

        return res.status(200).json({ data: merged, total: merged.length });
    } catch (err: any) {
        return res.status(500).json({ error: 'network_error', message: err.message });
    }
}
