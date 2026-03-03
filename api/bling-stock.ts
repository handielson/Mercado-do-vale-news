// Proxy para buscar saldos de estoque do Bling (server-side, sem CORS)
export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });

    const page = req.query.page || 1;

    try {
        const blingRes = await fetch(
            `https://www.bling.com.br/Api/v3/estoques/saldos?pagina=${page}&limite=100`,
            {
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                },
            }
        );

        if (!blingRes.ok) {
            const text = await blingRes.text();
            return res.status(blingRes.status).json({ error: `Bling stock error: ${blingRes.status}`, detail: text });
        }

        const data = await blingRes.json();
        return res.status(200).json(data);
    } catch (err: any) {
        return res.status(500).json({ error: 'network_error', message: err.message });
    }
}
