// Diagnóstico: verifica token Bling + lista escopos + testa endpoint contas-pagar
export default async function handler(req: any, res: any) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const headers = {
        'Authorization': authHeader,
        'Accept': 'application/json',
    };

    const BASE = 'https://www.bling.com.br/Api/v3';

    // Testa vários endpoints para descobrir qual funciona
    const tests: { name: string; url: string; status?: number; ok?: boolean; preview?: any; error?: string }[] = [
        { name: 'GET /produtos (deve funcionar)', url: `${BASE}/produtos?pagina=1&limite=1` },
        { name: 'GET /contas-pagar', url: `${BASE}/contas-pagar?pagina=1&limite=1` },
        { name: 'GET /contas-receber', url: `${BASE}/contas-receber?pagina=1&limite=1` },
        { name: 'GET /contasapagar', url: `${BASE}/contasapagar?pagina=1&limite=1` },
        { name: 'GET /contasreceber', url: `${BASE}/contasreceber?pagina=1&limite=1` },
    ];

    const results = await Promise.all(
        tests.map(async (t) => {
            try {
                const r = await fetch(t.url, { headers });
                const body = await r.text();
                let preview: any = null;
                try { preview = JSON.parse(body); } catch { preview = body.slice(0, 200); }
                return { ...t, status: r.status, ok: r.ok, preview };
            } catch (err: any) {
                return { ...t, status: 0, ok: false, error: err.message };
            }
        })
    );

    return res.status(200).json({
        token_prefix: authHeader.slice(0, 20) + '...',
        results,
    });
}
