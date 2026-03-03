// Proxy serverless: busca categorias de produtos do Bling (sem CORS)
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const page = req.query.page || 1;

    try {
        const r = await fetch(
            `https://www.bling.com.br/Api/v3/categorias/produtos?pagina=${page}&limite=100`,
            { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
        );
        if (!r.ok) return res.status(r.status).json({ error: `Bling error: ${r.status}`, detail: await r.text() });
        return res.status(200).json(await r.json());
    } catch (err: any) {
        return res.status(500).json({ error: 'network_error', message: err.message });
    }
}
