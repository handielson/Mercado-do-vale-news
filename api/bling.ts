/**
 * api/bling.ts — Serverless Function Unificada do Bling
 *
 * Consolida todas as rotas Bling em um único endpoint para respeitar o limite
 * de 12 Serverless Functions do plano Hobby da Vercel.
 *
 * Roteamento via query: ?resource=products|categories|stock|stock-sync|product-detail|finance|exchange|webhook
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

export default async function handler(req: any, res: any) {
    const resource = req.query.resource as string;

    // ─── EXCHANGE: troca authorization_code / refresh_token por access_token ───
    if (resource === 'exchange') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { code, client_id, client_secret, redirect_uri, grant_type } = req.body;
        if (!client_id || !client_secret) return res.status(400).json({ error: 'Missing client_id or client_secret' });
        const isRefresh = grant_type === 'refresh_token';
        if (isRefresh && !code) return res.status(400).json({ error: 'Missing refresh_token' });
        if (!isRefresh && (!code || !redirect_uri)) return res.status(400).json({ error: 'Missing required fields: code, redirect_uri' });
        const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
        const body = isRefresh
            ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: String(code) })
            : new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: String(redirect_uri) });
        try {
            const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credentials}` },
                body: body.toString(),
            });
            const data = await tokenRes.json();
            if (!tokenRes.ok) return res.status(tokenRes.status).json({ error: 'token_exchange_failed', details: data });
            return res.status(200).json({ access_token: data.access_token, refresh_token: data.refresh_token || null, expires_in: data.expires_in || 3600 });
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    // ─── CATEGORIES: lista categorias de produtos ───────────────────────────
    if (resource === 'categories') {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
        const page = req.query.page || 1;
        try {
            const r = await fetch(`https://www.bling.com.br/Api/v3/categorias/produtos?pagina=${page}&limite=100`, {
                headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            });
            if (!r.ok) return res.status(r.status).json({ error: `Bling error: ${r.status}`, detail: await r.text() });
            return res.status(200).json(await r.json());
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    // ─── PRODUCTS: busca lista de produtos ──────────────────────────────────
    if (resource === 'products') {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
        const page = req.query.page || 1;
        const search = req.query.search as string | undefined;
        const headers = { 'Authorization': authHeader, 'Accept': 'application/json' };
        const base = `https://www.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100&criterio=5`;
        try {
            if (!search) {
                const r = await fetch(base, { headers });
                if (!r.ok) return res.status(r.status).json({ error: `Bling error: ${r.status}`, detail: await r.text() });
                return res.status(200).json(await r.json());
            }
            const [byName, bySku] = await Promise.all([
                fetch(`${base}&nome=${encodeURIComponent(search)}`, { headers }),
                fetch(`${base}&codigo=${encodeURIComponent(search)}`, { headers }),
            ]);
            const nameData = byName.ok ? await byName.json() : { data: [] };
            const skuData = bySku.ok ? await bySku.json() : { data: [] };
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

    // ─── PRODUCT-DETAIL: busca detalhe completo de um produto por ID ────────
    if (resource === 'product-detail') {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        let authHeader = req.headers['authorization'];
        if (!authHeader) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: settings } = await supabase
                .from('company_settings')
                .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
                .single();
            if (!settings?.bling_access_token) return res.status(401).json({ error: 'Bling not connected' });
            let accessToken = settings.bling_access_token;
            if (settings.bling_token_expires_at && new Date(settings.bling_token_expires_at) < new Date()) {
                const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.bling_refresh_token, client_id: settings.bling_client_id, client_secret: settings.bling_client_secret }),
                });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    accessToken = tokenData.access_token;
                    await supabase.from('company_settings').update({ bling_access_token: tokenData.access_token, bling_refresh_token: tokenData.refresh_token, bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString() }).eq('id', settings.id ?? 1);
                }
            }
            authHeader = `Bearer ${accessToken}`;
        }
        const { id, variacoes } = req.query;
        if (!id) return res.status(400).json({ error: 'Product ID required' });
        try {
            if (variacoes === '1') {
                const varRes = await fetch(`https://www.bling.com.br/Api/v3/produtos/variacoes/${id}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                if (!varRes.ok) return res.status(varRes.status).json({ error: `Bling error: ${varRes.status}` });
                const varData = await varRes.json();
                return res.status(200).json(varData.data || {});
            }
            const [prodRes, stockRes] = await Promise.all([
                fetch(`https://www.bling.com.br/Api/v3/produtos/${id}`, { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }),
                fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=100&idsProdutos[]=${id}`, { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }),
            ]);
            if (!prodRes.ok) return res.status(prodRes.status).json({ error: `Bling error: ${prodRes.status}`, detail: await prodRes.text() });
            const prodData = await prodRes.json();
            const produto = prodData.data;
            let stock_quantity = 0;
            if (stockRes.ok) {
                const stockData = await stockRes.json();
                for (const item of (stockData.data || [])) stock_quantity += item.saldoFisico ?? 0;
            }
            if (stock_quantity === 0 && produto.estoque?.saldoVirtualTotal) stock_quantity = produto.estoque.saldoVirtualTotal;
            return res.status(200).json({ ...produto, stock_quantity });
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    // ─── STOCK: busca saldos de estoque ─────────────────────────────────────
    if (resource === 'stock') {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
        const page = req.query.page || 1;
        try {
            const blingRes = await fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?pagina=${page}&limite=100`, {
                headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
            });
            if (blingRes.status === 400) return res.status(200).json({ data: [] });
            if (!blingRes.ok) return res.status(blingRes.status).json({ error: `Bling stock error: ${blingRes.status}`, detail: await blingRes.text() });
            return res.status(200).json(await blingRes.json());
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    // ─── STOCK-SYNC: deduz estoque de um produto (chamado pelo PDV) ─────────
    if (resource === 'stock-sync') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { blingId, quantity, notes } = req.body || {};
        if (!blingId || !quantity) return res.status(400).json({ error: 'blingId and quantity required' });
        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: settings } = await supabase
                .from('company_settings')
                .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
                .single();
            if (!settings?.bling_access_token) return res.status(401).json({ error: 'Bling not connected' });
            let accessToken = settings.bling_access_token;
            if (settings.bling_token_expires_at && new Date(settings.bling_token_expires_at) < new Date()) {
                const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.bling_refresh_token, client_id: settings.bling_client_id, client_secret: settings.bling_client_secret }),
                });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    accessToken = tokenData.access_token;
                    await supabase.from('company_settings').update({ bling_access_token: tokenData.access_token, bling_refresh_token: tokenData.refresh_token, bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString() }).eq('id', settings.id ?? 1);
                }
            }
            const depRes = await fetch('https://www.bling.com.br/Api/v3/depositos?pagina=1&limite=1', { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } });
            const depData = await depRes.json();
            const depositoId = depData.data?.[0]?.id;
            if (!depositoId) return res.status(422).json({ error: 'No Bling deposit found' });
            const stockRes = await fetch('https://www.bling.com.br/Api/v3/estoques', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ produto: { id: blingId }, deposito: { id: depositoId }, operacao: 'S', quantidade: quantity, observacoes: notes || 'Venda PDV Mercado do Vale' }),
            });
            if (!stockRes.ok) return res.status(stockRes.status).json({ error: `Bling stock error: ${await stockRes.text()}` });
            return res.status(200).json({ ok: true });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── WEBHOOK: recebe notificações de estoque do Bling ───────────────────
    if (resource === 'webhook') {
        if (req.method === 'GET') return res.status(200).json({ ok: true });
        if (req.method !== 'POST') return res.status(405).end();
        try {
            const payload = req.body;
            const evento = payload?.evento || payload?.event;
            const blingId = payload?.data?.produto?.id || payload?.dados?.produto?.id;
            const saldo = payload?.data?.saldoFisico ?? payload?.dados?.saldoFisico;
            if (evento !== 'Estoque' || !blingId || saldo === undefined) return res.status(200).json({ ok: true, ignored: true });
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { error } = await supabase.from('products').update({ stock_quantity: Math.max(0, saldo) }).eq('bling_id', blingId);
            if (error) return res.status(200).json({ ok: false, error: error.message });
            return res.status(200).json({ ok: true });
        } catch (err: any) {
            return res.status(200).json({ ok: false, error: err.message });
        }
    }

    // ─── FINANCE: Contas a Pagar / Receber ──────────────────────────────────
    if (resource === 'finance') {
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ error: 'Missing Authorization header' });
        const headers = { 'Authorization': authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json' };
        const BASE = 'https://api.bling.com.br/Api/v3';
        const { action, id, resourceType } = req.query as Record<string, string>;
        if (!resourceType || !['pagar', 'receber'].includes(resourceType)) return res.status(400).json({ error: 'resourceType must be "pagar" or "receber"' });
        const endpoint = resourceType === 'pagar' ? 'contas/pagar' : 'contas/receber';
        try {
            if (action === 'list' && req.method === 'GET') {
                const { pagina = '1', limite = '100', dataVencimentoInicio, dataVencimentoFim, situacao } = req.query;
                let url = `${BASE}/${endpoint}?pagina=${pagina}&limite=${limite}`;
                if (dataVencimentoInicio) url += `&dataInicial=${dataVencimentoInicio}`;
                if (dataVencimentoFim) url += `&dataFinal=${dataVencimentoFim}`;
                if (situacao) url += `&situacoes[]=${situacao === 'pago' ? 2 : situacao === 'cancelado' ? 4 : situacao === 'em_aberto' ? 1 : situacao}`;
                const r = await fetch(url, { headers });
                const body = await r.text();
                if (!r.ok) {
                    let parsed: any = {};
                    try { parsed = JSON.parse(body); } catch { }
                    return res.status(r.status).json({ error: `Bling ${r.status}`, detail: parsed?.error?.description || body });
                }
                return res.status(200).json(JSON.parse(body));
            }
            if (action === 'get' && req.method === 'GET' && id) {
                const r = await fetch(`${BASE}/${endpoint}/${id}`, { headers });
                if (!r.ok) return res.status(r.status).json({ error: `Bling error: ${r.status}` });
                return res.status(200).json(await r.json());
            }
            if (action === 'create' && req.method === 'POST') {
                const r = await fetch(`${BASE}/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(req.body) });
                const data = await r.json();
                if (!r.ok) return res.status(r.status).json({ error: data });
                return res.status(200).json(data);
            }
            if (action === 'update' && req.method === 'PUT' && id) {
                const r = await fetch(`${BASE}/${endpoint}/${id}`, { method: 'PUT', headers, body: JSON.stringify(req.body) });
                const data = await r.json();
                if (!r.ok) return res.status(r.status).json({ error: data });
                return res.status(200).json(data);
            }
            if (action === 'baixar' && req.method === 'POST' && id) {
                const r = await fetch(`${BASE}/${endpoint}/${id}/baixar`, { method: 'POST', headers, body: JSON.stringify(req.body) });
                const data = await r.json();
                if (!r.ok) return res.status(r.status).json({ error: data });
                return res.status(200).json(data);
            }
            if (action === 'cancelar' && req.method === 'DELETE' && id) {
                const r = await fetch(`${BASE}/${endpoint}/${id}`, { method: 'DELETE', headers });
                if (!r.ok) return res.status(r.status).json({ error: `Bling error: ${r.status}` });
                return res.status(200).json({ success: true });
            }
            return res.status(400).json({ error: 'Invalid action or method' });
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    return res.status(400).json({ error: 'Invalid resource. Valid: exchange|categories|products|product-detail|stock|stock-sync|webhook|finance' });
}
