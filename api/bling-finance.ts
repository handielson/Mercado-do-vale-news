// Proxy serverless para Contas a Pagar e Receber do Bling API v3
export default async function handler(req: any, res: any) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const headers = {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    const BASE = 'https://api.bling.com.br/Api/v3';


    // Path: /api/bling-finance?resource=pagar|receber&action=list|get|create|update|baixar&id=...
    const { resource, action, id } = req.query as Record<string, string>;

    if (!resource || !['pagar', 'receber'].includes(resource)) {
        return res.status(400).json({ error: 'resource must be "pagar" or "receber"' });
    }

    // ✅ Endpoint correto confirmado: /contas/pagar e /contas/receber (barra, não hífen)
    const endpoint = resource === 'pagar' ? 'contas/pagar' : 'contas/receber';


    try {
        if (action === 'list' && req.method === 'GET') {
            // GET /contas-pagar?pagina=1&limite=100&dataVencimentoInicio=...&dataVencimentoFim=...&situacao=...
            const { pagina = '1', limite = '100', dataVencimentoInicio, dataVencimentoFim, situacao } = req.query;
            let url = `${BASE}/${endpoint}?pagina=${pagina}&limite=${limite}`;
            if (dataVencimentoInicio) url += `&dataVencimentoInicio=${dataVencimentoInicio}`;
            if (dataVencimentoFim) url += `&dataVencimentoFim=${dataVencimentoFim}`;
            if (situacao) url += `&situacao=${situacao}`;

            const r = await fetch(url, { headers });
            const body = await r.text();
            if (!r.ok) {
                let parsed: any = {};
                try { parsed = JSON.parse(body); } catch { }
                const blingMsg = parsed?.error?.description || parsed?.mensagem || parsed?.message || body;
                return res.status(r.status).json({
                    error: `Bling ${r.status}`,
                    detail: blingMsg,
                    hint: r.status === 404
                        ? 'Verifique se o escopo "Contas a Pagar/Receber" está habilitado no app Bling.'
                        : r.status === 401
                            ? 'Token expirado. Reconecte o Bling em Configurações > Integração Bling.'
                            : undefined,
                });
            }
            return res.status(200).json(JSON.parse(body));
        }


        if (action === 'get' && req.method === 'GET' && id) {
            const r = await fetch(`${BASE}/${endpoint}/${id}`, { headers });
            if (!r.ok) return res.status(r.status).json({ error: `Bling error: ${r.status}` });
            return res.status(200).json(await r.json());
        }

        if (action === 'create' && req.method === 'POST') {
            const r = await fetch(`${BASE}/${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(req.body),
            });
            const data = await r.json();
            if (!r.ok) return res.status(r.status).json({ error: data });
            return res.status(200).json(data);
        }

        if (action === 'update' && req.method === 'PUT' && id) {
            const r = await fetch(`${BASE}/${endpoint}/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(req.body),
            });
            const data = await r.json();
            if (!r.ok) return res.status(r.status).json({ error: data });
            return res.status(200).json(data);
        }

        if (action === 'baixar' && req.method === 'POST' && id) {
            const r = await fetch(`${BASE}/${endpoint}/${id}/baixas`, {
                method: 'POST',
                headers,
                body: JSON.stringify(req.body),
            });
            const data = await r.json();
            if (!r.ok) return res.status(r.status).json({ error: data });
            return res.status(200).json(data);
        }

        if (action === 'cancelar' && req.method === 'DELETE' && id) {
            const r = await fetch(`${BASE}/${endpoint}/${id}`, {
                method: 'DELETE',
                headers,
            });
            if (!r.ok) return res.status(r.status).json({ error: `Bling error: ${r.status}` });
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action or method' });
    } catch (err: any) {
        return res.status(500).json({ error: 'network_error', message: err.message });
    }
}
