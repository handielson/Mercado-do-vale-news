/**
 * api/bling.ts — Serverless Function Unificada do Bling
 *
 * Consolida todas as rotas Bling em um único endpoint para respeitar o limite
 * de 12 Serverless Functions do plano Hobby da Vercel.
 *
 * Roteamento via query: ?resource=products|categories|stock|stock-sync|product-detail|finance|exchange|webhook|reconcile
 */
import { createClient } from '@supabase/supabase-js';
import blingWebhookHandler from './bling-webhook.js';
import { buildBlingReconcilePlan } from './_lib/bling-reconcile-core.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
const blingApiBase = 'https://api.bling.com.br/Api/v3';
const vpsBaseUrl = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const vpsSyncKey = process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';
const reconcilePageSize = 100;
const reconcileLocalPageSize = 1000;

function isBlingReconcileAuthorized(req: any): boolean {
    const authHeader = String(req.headers?.authorization || '');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        return authHeader === `Bearer ${cronSecret}`;
    }

    const syncHeader = String(req.headers?.['x-sync-key'] || req.headers?.['x-api-key'] || '');
    if (vpsSyncKey && syncHeader === vpsSyncKey) {
        return true;
    }

    const userAgent = String(req.headers?.['user-agent'] || '');
    return userAgent.includes('vercel-cron/1.0');
}

async function getValidBlingAccessTokenForReconcile(supabase: any) {
    const { data: settings } = await supabase
        .from('company_settings')
        .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
        .limit(1)
        .maybeSingle();

    if (!settings?.bling_access_token) {
        throw new Error('Bling not connected');
    }

    let accessToken: string | null = settings.bling_access_token;
    const tokenExpired = settings.bling_token_expires_at && new Date(settings.bling_token_expires_at) < new Date();
    if (!tokenExpired) {
        return accessToken;
    }

    const tokenRes = await fetch(`${blingApiBase}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: settings.bling_refresh_token,
            client_id: settings.bling_client_id,
            client_secret: settings.bling_client_secret,
        }),
        signal: AbortSignal.timeout(10000),
    });

    if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        accessToken = tokenData.access_token;
        await supabase.from('company_settings').update({
            bling_access_token: tokenData.access_token,
            bling_refresh_token: tokenData.refresh_token,
            bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        }).eq('id', settings.id);
        return accessToken;
    }

    if (tokenRes.status === 400 || tokenRes.status === 401) {
        await supabase.from('company_settings').update({
            bling_access_token: null,
        }).eq('id', settings.id);
    }

    throw new Error(`Bling token refresh failed (${tokenRes.status}): ${await tokenRes.text()}`);
}

async function getStoredBlingAccessToken(supabase: any, forceRefresh = false): Promise<string> {
    const { data: settings } = await supabase
        .from('company_settings')
        .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
        .limit(1)
        .maybeSingle();

    if (!settings?.bling_access_token) {
        throw new Error('Bling not connected');
    }

    const expiresAt = settings.bling_token_expires_at
        ? new Date(settings.bling_token_expires_at).getTime()
        : 0;
    const shouldRefresh = forceRefresh || (expiresAt && expiresAt <= Date.now() + 5 * 60 * 1000);

    if (!shouldRefresh) {
        return settings.bling_access_token;
    }

    if (!settings.bling_refresh_token) {
        return settings.bling_access_token;
    }

    const tokenRes = await fetch(`${blingApiBase}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: settings.bling_refresh_token,
            client_id: settings.bling_client_id,
            client_secret: settings.bling_client_secret,
        }),
        signal: AbortSignal.timeout(10000),
    });

    if (!tokenRes.ok) {
        throw new Error(`Bling token refresh failed (${tokenRes.status}): ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json();
    await supabase.from('company_settings').update({
        bling_access_token: tokenData.access_token,
        bling_refresh_token: tokenData.refresh_token || settings.bling_refresh_token,
        bling_token_expires_at: new Date(Date.now() + (Number(tokenData.expires_in) || 3600) * 1000).toISOString(),
    }).eq('id', settings.id);

    return tokenData.access_token;
}

function bearer(tokenOrHeader: string) {
    return tokenOrHeader.startsWith('Bearer ') ? tokenOrHeader : `Bearer ${tokenOrHeader}`;
}

async function fetchBlingWithStoredTokenRetry(supabase: any, url: string, authHeader?: string) {
    const initialAuth = authHeader || bearer(await getStoredBlingAccessToken(supabase));
    let response = await fetch(url, {
        headers: { 'Authorization': initialAuth, 'Accept': 'application/json' },
    });

    if (response.status === 401) {
        const refreshedToken = await getStoredBlingAccessToken(supabase, true);
        response = await fetch(url, {
            headers: { 'Authorization': bearer(refreshedToken), 'Accept': 'application/json' },
        });
    }

    return response;
}

async function fetchAllLocalProductsForReconcile(supabase: any) {
    const localProducts: any[] = [];

    for (let from = 0; ; from += reconcileLocalPageSize) {
        const to = from + reconcileLocalPageSize - 1;
        const { data, error } = await supabase
            .from('products')
            .select('id, sku, name, stock_quantity, bling_id')
            .not('bling_id', 'is', null)
            .range(from, to);

        if (error) {
            throw new Error(`Supabase products fetch failed: ${error.message}`);
        }

        const rows = data || [];
        localProducts.push(...rows);

        if (rows.length < reconcileLocalPageSize) {
            break;
        }
    }

    return localProducts;
}

async function fetchAllBlingProductsForReconcile(accessToken: string) {
    const remoteProducts: any[] = [];

    for (let page = 1; ; page += 1) {
        const res = await fetch(`${blingApiBase}/produtos?pagina=${page}&limite=${reconcilePageSize}&criterio=5`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            throw new Error(`Bling products fetch failed (${res.status}): ${await res.text()}`);
        }

        const json = await res.json();
        const pageItems = Array.isArray(json?.data) ? json.data : [];
        remoteProducts.push(...pageItems);

        if (pageItems.length < reconcilePageSize) {
            break;
        }
    }

    return remoteProducts;
}

async function fetchAllBlingStocksForReconcile(accessToken: string) {
    const remoteStocks: any[] = [];

    for (let page = 1; ; page += 1) {
        const res = await fetch(`${blingApiBase}/estoques/saldos?pagina=${page}&limite=${reconcilePageSize}`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(15000),
        });

        if (res.status === 400) {
            break;
        }

        if (!res.ok) {
            throw new Error(`Bling stock fetch failed (${res.status}): ${await res.text()}`);
        }

        const json = await res.json();
        const pageItems = Array.isArray(json?.data) ? json.data : [];
        remoteStocks.push(...pageItems);

        if (pageItems.length < reconcilePageSize) {
            break;
        }
    }

    return remoteStocks;
}

async function patchVpsForReconcile(path: string, body: object): Promise<boolean> {
    if (!vpsSyncKey) return false;

    try {
        const res = await fetch(`${vpsBaseUrl}${path}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-sync-key': vpsSyncKey,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        });

        return res.ok;
    } catch {
        return false;
    }
}

async function applyReconcileStockChanges(supabase: any, changes: any[]) {
    const applied = [];
    const failed = [];

    for (const change of changes) {
        const { error } = await supabase
            .from('products')
            .update({ stock_quantity: change.nextStock })
            .eq('id', change.productId);

        if (error) {
            failed.push({ type: 'stock', sku: change.sku, blingId: change.blingId, reason: error.message });
            continue;
        }

        const vpsUpdated = await patchVpsForReconcile(
            '/products/stock',
            change.blingId
                ? { bling_id: change.blingId, stock_quantity: change.nextStock }
                : { sku: change.sku, stock_quantity: change.nextStock },
        );

        applied.push({ ...change, vpsUpdated });
    }

    return { applied, failed };
}

async function applyReconcileNameChanges(supabase: any, changes: any[]) {
    const applied = [];
    const failed = [];

    for (const change of changes) {
        const { error } = await supabase
            .from('products')
            .update({ name: change.nextName })
            .eq('id', change.productId);

        if (error) {
            failed.push({ type: 'name', sku: change.sku, blingId: change.blingId, reason: error.message });
            continue;
        }

        const vpsUpdated = change.sku
            ? await patchVpsForReconcile('/products/name', { sku: change.sku, name: change.nextName })
            : false;

        applied.push({ ...change, vpsUpdated });
    }

    return { applied, failed };
}

export default async function handler(req: any, res: any) {
    const resource = req.query.resource as string;
    const safeRedirect = (location: string, statusCode = 302) => {
        res.statusCode = statusCode;
        res.setHeader('Location', location);
        return res.end();
    };

    // ─── OAUTH-CALLBACK: recebe o code do Bling e troca por access_token ───────
    // Chamado via rewrite: /api/auth/callback/bling → /api/bling?resource=oauth-callback
    if (resource === 'oauth-callback' || req.query.code) {
        const { code, error: oauthError, error_description } = req.query;

        if (oauthError) {
            console.error('Bling OAuth error:', oauthError, error_description);
            return safeRedirect(`/admin/settings/bling?error=${encodeURIComponent(String(oauthError))}`);
        }
        if (!code) {
            return safeRedirect('/admin/settings/bling?error=missing_code');
        }

        const supabaseUrl2 = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey2 = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl2 || !supabaseKey2) {
            return safeRedirect('/admin/settings/bling?error=server_config');
        }
        let supaOAuth;
        try {
            supaOAuth = createClient(supabaseUrl2, supabaseKey2, { auth: { persistSession: false, autoRefreshToken: false } });
        } catch (clientErr: any) {
            console.error('Supabase client init error:', clientErr);
            return safeRedirect('/admin/settings/bling?error=server_config');
        }

        const { data: settings2, error: settingsError2 } = await supaOAuth
            .from('company_settings')
            .select('id, bling_client_id, bling_client_secret, bling_callback_url')
            .limit(1)
            .maybeSingle();

        if (settingsError2 || !settings2?.bling_client_id || !settings2?.bling_client_secret) {
            return safeRedirect('/admin/settings/bling?error=missing_credentials');
        }

        const callbackUrl2 = settings2.bling_callback_url ? 
            (settings2.bling_callback_url.startsWith('http') ? settings2.bling_callback_url : `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${settings2.bling_callback_url}`)
            : `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/callback/bling`;
        try {
            const credentials2 = Buffer.from(`${settings2.bling_client_id}:${settings2.bling_client_secret}`).toString('base64');
            const tokenRes2 = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${credentials2}` },
                body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: callbackUrl2 }).toString(),
            });
            if (!tokenRes2.ok) {
                const errText2 = await tokenRes2.text();
                return safeRedirect(`/admin/settings/bling?error=token_exchange_failed&status=${tokenRes2.status}`);
            }
            const tokenData2 = await tokenRes2.json();
            const expiresAt2 = new Date(Date.now() + (tokenData2.expires_in || 3600) * 1000).toISOString();
            const { error: updateError } = await supaOAuth.from('company_settings').update({
                bling_access_token: tokenData2.access_token,
                bling_refresh_token: tokenData2.refresh_token || null,
                bling_token_expires_at: expiresAt2,
            }).eq('id', settings2.id);
            if (updateError) {
                console.error('Supabase update error:', updateError);
                return safeRedirect(`/admin/settings/bling?error=database_error&detail=${encodeURIComponent(updateError.message)}`);
            }
            return safeRedirect('/admin/settings/bling?connected=true');
        } catch (fetchErr2: any) {
            console.error('OAuth callback error:', fetchErr2);
            return safeRedirect(`/admin/settings/bling?error=network_error&detail=${encodeURIComponent(fetchErr2.message)}`);
        }
    }

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
            const tokenRes = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
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
            const r = await fetch(`https://api.bling.com.br/Api/v3/categorias/produtos?pagina=${page}&limite=100`, {
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
        const base = `https://api.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100&criterio=5`;
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
                const tokenRes = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.bling_refresh_token, client_id: settings.bling_client_id, client_secret: settings.bling_client_secret }),
                });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    accessToken = tokenData.access_token;
                    const { error: updateErr } = await supabase.from('company_settings').update({ bling_access_token: tokenData.access_token, bling_refresh_token: tokenData.refresh_token, bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString() }).eq('id', settings.id ?? 1);
                    if (updateErr) console.error('Token refresh update failed:', updateErr);
                }
            }
            authHeader = `Bearer ${accessToken}`;
        }
        const { id, variacoes } = req.query;
        if (!id) return res.status(400).json({ error: 'Product ID required' });
        try {
            if (variacoes === '1') {
                const varRes = await fetch(`https://api.bling.com.br/Api/v3/produtos/variacoes/${id}`, {
                    headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
                });
                if (!varRes.ok) return res.status(varRes.status).json({ error: `Bling error: ${varRes.status}` });
                const varData = await varRes.json();
                return res.status(200).json(varData.data || {});
            }
            const [prodRes, stockRes] = await Promise.all([
                fetch(`https://api.bling.com.br/Api/v3/produtos/${id}`, { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }),
                fetch(`https://api.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=100&idsProdutos[]=${id}`, { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }),
            ]);
            if (!prodRes.ok) return res.status(prodRes.status).json({ error: `Bling error: ${prodRes.status}`, detail: await prodRes.text() });
            const prodData = await prodRes.json();
            const produto = prodData.data;
            let stock_quantity = 0;
            if (stockRes.ok) {
                const stockData = await stockRes.json();
                for (const item of (stockData.data || [])) {
                    const stockVal = item.saldoFisicoTotal ?? item.saldoFisico ?? item.saldoVirtualTotal ?? item.saldoVirtual ?? 0;
                    stock_quantity += parseFloat(String(stockVal)) || 0;
                }
            } else {
                const errText = await stockRes.text();
                console.error('[Bling API] Error fetching stock:', stockRes.status, errText);
            }
            
            // Variation Fallback: If stock is 0, fallback to produto.estoque
            if (stock_quantity === 0 && produto?.estoque) {
                const fallbackStock = produto.estoque.saldoFisicoTotal ?? produto.estoque.saldoFisico ?? produto.estoque.saldoVirtualTotal ?? produto.estoque.saldoVirtual ?? 0;
                stock_quantity = parseFloat(String(fallbackStock)) || 0;
            }

            return res.status(200).json({ ...produto, stock_quantity: Number(stock_quantity) });
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    // ─── PRODUCT-UPDATE-DIMENSIONS: atualiza produtos no Bling em lote (apenas dimensões) ────────
    if (resource === 'product-update-dimensions') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { blingIds, updateData } = req.body;
        if (!blingIds || !Array.isArray(blingIds) || !updateData) return res.status(400).json({ error: 'blingIds array and updateData required' });

        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: settings } = await supabase
                .from('company_settings')
                .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
                .single();
            if (!settings?.bling_access_token) return res.status(401).json({ error: 'Bling not connected' });
            let accessToken = settings.bling_access_token;
            if (settings.bling_token_expires_at && new Date(settings.bling_token_expires_at) < new Date()) {
                const tokenRes = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.bling_refresh_token, client_id: settings.bling_client_id, client_secret: settings.bling_client_secret }),
                });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    accessToken = tokenData.access_token;
                    const { error: updateErr } = await supabase.from('company_settings').update({ bling_access_token: tokenData.access_token, bling_refresh_token: tokenData.refresh_token, bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString() }).eq('id', settings.id ?? 1);
                    if (updateErr) console.error('Token refresh (finance) update failed:', updateErr);
                }
            }

            const results = [];
            for (const blingId of blingIds) {
                // 1. Fetch current product detail to avoid overwriting existing fields
                const prodRes = await fetch(`https://api.bling.com.br/Api/v3/produtos/${blingId}`, { 
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } 
                });
                if (!prodRes.ok) {
                    results.push({ id: blingId, success: false, error: 'fetch_failed', detail: await prodRes.text() });
                    continue;
                }
                const prodData = await prodRes.json();
                const produto = prodData.data;

                // 2. Map and merge new dimensions
                const payload = {
                    ...produto,
                    pesoBruto: updateData.pesoBruto !== undefined ? updateData.pesoBruto : produto.pesoBruto,
                    dimensoes: {
                        ...(produto.dimensoes || {}),
                        ...(updateData.dimensoes || {})
                    }
                };

                // Remove readonly ou arrays não necessários (para garantir update liso)
                delete payload.estoque;

                // 3. PUT updated product
                const putRes = await fetch(`https://api.bling.com.br/Api/v3/produtos/${blingId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (putRes.ok) {
                    results.push({ id: blingId, success: true });
                } else {
                    results.push({ id: blingId, success: false, error: 'update_failed', detail: await putRes.text() });
                }
            }

            return res.status(200).json({ ok: true, results });
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    // ─── IMAGE-PROXY: baixa a imagem de hosts confiaveis ignorando CORS ────
    if (resource === 'image-proxy') {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const { url } = req.query;
        if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url parameter' });

        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'https:') {
                return res.status(400).json({ error: 'Only https URLs are supported' });
            }

            const allowedExactHosts = new Set<string>([
                'orgbling.s3.amazonaws.com',
                'i.imgur.com',
                'imgur.com',
            ]);
            const allowedSuffixes: string[] = [
                'xiaomipetrolina.com.br',
                'mercadodovale.com.br',
                'supabase.co',
            ];

            const vpsBase = process.env.VITE_VPS_BASE_URL || process.env.VPS_BASE_URL;
            if (vpsBase) {
                try { allowedExactHosts.add(new URL(vpsBase).hostname); } catch { /* ignore */ }
            }

            const host = parsedUrl.hostname.toLowerCase();
            const isAllowed = allowedExactHosts.has(host)
                || allowedSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));

            if (!isAllowed) {
                return res.status(400).json({ error: 'Unsupported image host', host });
            }

            const imgRes = await fetch(url);
            if (!imgRes.ok) return res.status(imgRes.status).json({ error: 'Failed to fetch image from URL' });

            const arrayBuffer = await imgRes.arrayBuffer();
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
            return res.status(200).send(Buffer.from(arrayBuffer));
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
            let url = `https://api.bling.com.br/Api/v3/estoques/saldos?pagina=${page}&limite=100`;
            
            // Forward idsProdutos[] array if present (support both express parsing variants)
            const idsParam = req.query['idsProdutos[]'] || req.query.idsProdutos;
            if (idsParam) {
                const ids = Array.isArray(idsParam) ? idsParam : [idsParam];
                const idsQuery = ids.map((id: any) => `idsProdutos[]=${id}`).join('&');
                url = `https://api.bling.com.br/Api/v3/estoques/saldos?pagina=${page}&limite=100&${idsQuery}`;
            }

            const blingRes = await fetch(url, {
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
                const tokenRes = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.bling_refresh_token, client_id: settings.bling_client_id, client_secret: settings.bling_client_secret }),
                });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    accessToken = tokenData.access_token;
                    const { error: updateErr } = await supabase.from('company_settings').update({ bling_access_token: tokenData.access_token, bling_refresh_token: tokenData.refresh_token, bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString() }).eq('id', settings.id ?? 1);
                    if (updateErr) console.error('Token refresh (stock) update failed:', updateErr);
                }
            }
            const depRes = await fetch('https://api.bling.com.br/Api/v3/depositos?pagina=1&limite=1', { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } });
            const depData = await depRes.json();
            const depositoId = depData.data?.[0]?.id;
            if (!depositoId) return res.status(422).json({ error: 'No Bling deposit found' });
            const stockRes = await fetch('https://api.bling.com.br/Api/v3/estoques', {
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

    // Documentação oficial: https://developer.bling.com.br/webhooks#/estoques
    // Payload Versão 1 (stock.updated / stock.created):
    // {
    //   eventId, date, version, event: "stock.updated", companyId,
    //   data: {
    //     produto: { id: 12345678 },
    //     deposito: { id, saldoFisico, saldoVirtual },
    //     operacao: "E",
    //     quantidade: 26,
    //     saldoFisicoTotal: 1500.75,   <- total somando todos os depósitos
    //     saldoVirtualTotal: 1500.75
    //   }
    // }
    if (resource === 'webhook') {
        // Compatibilidade: mantém a URL legada ativa, mas com processamento centralizado
        // no handler dedicado `api/bling-webhook.ts` para evitar drift entre endpoints.
        if (req.method === 'GET') {
            return res.status(200).json({ ok: true, mode: 'legacy-proxy', target: '/api/bling-webhook' });
        }
        if (req.method !== 'POST') return res.status(405).end();
        try {
            const srKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
                || process.env.SUPABASE_SERVICE_ROLE_KEY
                || process.env.VITE_SUPABASE_ANON_KEY
                || process.env.SUPABASE_ANON_KEY!;
            const supabase = createClient(supabaseUrl, srKey);
            // Mantém histórico dos POSTs que chegam pela URL legada para diagnóstico.
            try {
                await supabase.from('webhook_logs').insert({
                    source: 'bling-legacy',
                    payload: req.body,
                    received_at: new Date().toISOString(),
                });
            } catch (_) { }

            return await blingWebhookHandler(req, res);
        } catch (err: any) {
            return res.status(200).json({ ok: false, error: err.message });
        }
    }


    // ─── WEBHOOK-LOGS: leitura dos últimos logs para diagnóstico ────────────
    if (resource === 'webhook-logs') {
        if (req.method !== 'GET') return res.status(405).end();
        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data, error } = await supabase
                .from('webhook_logs')
                .select('id, source, payload, received_at')
                .order('received_at', { ascending: false })
                .limit(20);
            if (error) return res.status(200).json({ ok: false, tableExists: false, error: error.message, logs: [] });
            return res.status(200).json({ ok: true, tableExists: true, logs: data || [] });
        } catch (err: any) {
            return res.status(200).json({ ok: false, error: err.message, logs: [] });
        }
    }

    // ─── FIX-PROFILE: insere/atualiza o perfil do usuário admin ─────────────
    if (resource === 'fix-profile') {
        if (req.method !== 'POST') return res.status(405).end();
        try {
            const { userId } = req.body;
            if (!userId) return res.status(400).json({ error: 'userId is required' });
            const srKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
                || process.env.SUPABASE_SERVICE_ROLE_KEY
                || process.env.VITE_SUPABASE_ANON_KEY
                || process.env.SUPABASE_ANON_KEY!;
            const supabase = createClient(supabaseUrl, srKey);
            // Busca o company_id da empresa
            const { data: company } = await supabase
                .from('companies')
                .select('id')
                .eq('slug', 'mercado-do-vale')
                .single();
            if (!company) return res.status(404).json({ error: 'Company not found' });
            // Upsert do perfil
            const { data, error } = await supabase
                .from('profiles')
                .upsert({ id: userId, company_id: company.id }, { onConflict: 'id' })
                .select();
            if (error) return res.status(500).json({ ok: false, error: error.message });
            return res.status(200).json({ ok: true, profile: data?.[0], company_id: company.id });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── DEBUG-PRODUCT: inspeciona payload cru do Bling ────────────
    if (resource === 'debug-product') {
        if (req.method !== 'GET') return res.status(405).end();
        try {
            const { blingId } = req.query;
            if (!blingId) return res.status(400).json({ error: 'blingId is required' });
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: settings } = await supabase.from('company_settings').select('bling_access_token').single();
            const resBling = await fetch(`https://api.bling.com.br/Api/v3/produtos/${blingId}`, { 
                headers: { 'Authorization': `Bearer ${settings?.bling_access_token}`, 'Accept': 'application/json' } 
            });
            const data = await resBling.json();
            return res.status(200).json(data);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── DEBUG-DIAGNOSTIC: Test stock endpoint ────────────
    if (resource === 'debug-diagnostic') {
        if (req.method !== 'GET') return res.status(405).end();
        try {
            const { blingId } = req.query;
            if (!blingId) return res.status(400).json({ error: 'blingId is required' });
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: settings } = await supabase.from('company_settings').select('bling_access_token').single();
            
            const resBling = await fetch(`https://api.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${blingId}`, { 
                headers: { 'Authorization': `Bearer ${settings?.bling_access_token}`, 'Accept': 'application/json' } 
            });
            const data = await resBling.json();
            
            const resProd = await fetch(`https://api.bling.com.br/Api/v3/produtos/${blingId}`, {
                headers: { 'Authorization': `Bearer ${settings?.bling_access_token}`, 'Accept': 'application/json' }
            });
            const prodData = await resProd.json();
            
            return res.status(200).json({ stock: data, product: prodData });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── SYNC-MODEL-BRAND: atualiza brand_id de um modelo (requer service-role) ─
    if (resource === 'sync-model-brand') {
        if (req.method !== 'POST') return res.status(405).end();
        try {
            const { model_id, brand_name } = req.body;
            if (!model_id || !brand_name) return res.status(400).json({ error: 'model_id and brand_name are required' });
            const srKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
            const supabase = createClient(supabaseUrl, srKey);
            
            // Get company_id for this model
            const { data: model } = await supabase.from('models').select('id, brand_id, company_id').eq('id', model_id).single();
            if (!model) return res.status(404).json({ error: 'Model not found' });
            
            const companyId = model.company_id;
            const slug = brand_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            
            // Find or create brand
            const { data: existingBrands } = await supabase.from('brands').select('id, name, slug, active, warranty_days').eq('company_id', companyId).ilike('name', brand_name);
            let brandId = existingBrands?.[0]?.id;
            let brandRow = existingBrands?.[0];
            let wasCreated = false;
            
            if (!brandId) {
                const { data: newBrand, error: createError } = await supabase.from('brands').insert({
                    company_id: companyId,
                    name: brand_name,
                    slug,
                    warranty_days: 90,
                    active: true
                }).select('id, name, slug, active, warranty_days').single();
                if (createError) return res.status(500).json({ error: 'Failed to create brand', detail: createError.message });
                brandId = newBrand.id;
                brandRow = newBrand;
                wasCreated = true;
            }
            
            // Update the model's brand_id
            const { error: updateError } = await supabase.from('models').update({ brand_id: brandId }).eq('id', model_id);
            if (updateError) return res.status(500).json({ error: 'Failed to update model brand', detail: updateError.message });

            // Sync brand to VPS (fire-and-forget)
            const vpsBase = 'https://api.xiaomipetrolina.com.br';
            const syncKey = process.env.VPS_SYNC_KEY || '';
            if (syncKey && brandRow) {
                const vpsBrandPayload = { ...brandRow, company_id: companyId };
                if (wasCreated) {
                    fetch(`${vpsBase}/brands`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
                        body: JSON.stringify(vpsBrandPayload)
                    }).catch(() => {});
                } else {
                    fetch(`${vpsBase}/brands/${brandId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
                        body: JSON.stringify(vpsBrandPayload)
                    }).catch(() => {});
                }
            }
            
            return res.status(200).json({ ok: true, brand_id: brandId, brand_name, model_id, was_created: wasCreated });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── FIX-BLING-ID: corrige o bling_id de um produto por SKU ─────────────
    if (resource === 'fix-bling-id') {
        if (req.method !== 'POST') return res.status(405).end();
        try {
            const { sku, blingId } = req.body;
            if (!sku || !blingId) return res.status(400).json({ error: 'sku e blingId são obrigatórios' });
            const supabase = createClient(supabaseUrl, supabaseKey);
            // Busca o produto atual para diagnóstico
            const { data: before } = await supabase.from('products').select('id, sku, bling_id, stock_quantity').eq('sku', sku).single();
            const { data: updated, error } = await supabase.from('products').update({ bling_id: Number(blingId) }).eq('sku', sku).select('id, sku, bling_id');
            if (error) return res.status(200).json({ ok: false, error: error.message });
            return res.status(200).json({ ok: true, before, after: updated?.[0] });
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

    // ─── NFe: lista NF-e emitidas ─────────────────────────────────────────────
    if (resource === 'nf-detail') {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const authHeader = req.headers['authorization'];

        const tipo = String(req.query.tipo || '').toLowerCase();
        const id = req.query.id;
        if (!['nfe', 'nfce'].includes(tipo)) return res.status(400).json({ error: 'tipo must be nfe or nfce' });
        if (!id) return res.status(400).json({ error: 'id is required' });

        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const r = await fetchBlingWithStoredTokenRetry(supabase, `https://api.bling.com.br/Api/v3/${tipo}/${id}`, authHeader);
            if (!r.ok) {
                const txt = await r.text();
                return res.status(r.status).json({ error: `Bling ${tipo} detail error: ${r.status}`, detail: txt });
            }
            return res.status(200).json(await r.json());
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    if (resource === 'nfe' || resource === 'nfce') {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const authHeader = req.headers['authorization'];
        const endpoint = resource === 'nfe' ? 'nfe' : 'nfce';
        const q = req.query as Record<string, string>;
        // Accept both blingNfService names (dataEmissaoInicio/Fim) and Bling native names
        const inicio = q.dataEmissaoInicio || q.dataEmissaoInicial || '';
        const fim    = q.dataEmissaoFim    || q.dataEmissaoFinal   || '';
        const situacao = q.situacao || '';
        const pagina   = q.pagina  || '1';
        let url = `https://api.bling.com.br/Api/v3/${endpoint}?pagina=${pagina}&limite=100`;
        if (inicio)   url += `&dataEmissaoInicial=${inicio}`;
        if (fim)      url += `&dataEmissaoFinal=${fim}`;
        if (situacao) url += `&situacao=${situacao}`;
        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const r = await fetchBlingWithStoredTokenRetry(supabase, url, authHeader);
            if (!r.ok) {
                const txt = await r.text();
                return res.status(r.status).json({ error: `Bling ${endpoint} error: ${r.status}`, detail: txt });
            }
            return res.status(200).json(await r.json());
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    // ─── SYNC-PRICES-VPS: lê preços/estoque do Supabase e sincroniza para VPS ─
    // Chamado em páginas pelo admin: ?resource=sync-prices-vps&page=0 (50 produtos por chamada)
    if (resource === 'sync-prices-vps') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        try {
            const srKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
                || process.env.SUPABASE_SERVICE_ROLE_KEY
                || supabaseKey;
            const supabase = createClient(supabaseUrl, srKey);
            const vpsBase = 'https://api.xiaomipetrolina.com.br';
            const syncKey = process.env.VPS_SYNC_KEY || '';
            if (!syncKey) return res.status(500).json({ error: 'VPS_SYNC_KEY not configured' });

            const pageSize = 50;
            const page = parseInt(String(req.query.page || req.body?.page || 0), 10);
            const from = page * pageSize;
            const to = from + pageSize - 1;

            // Lê dados do Supabase (fonte de verdade para preço/estoque)
            const { data: products, error: supErr, count } = await supabase
                .from('products')
                .select('id, name, sku, status, category_id, price_retail, price_reseller, price_wholesale, price_cost, stock_quantity, track_inventory, is_combo, bling_id, bling_parent_id, parent_id', { count: 'exact' })
                .range(from, to);

            if (supErr) return res.status(500).json({ error: supErr.message });
            if (!products || products.length === 0) {
                return res.status(200).json({ ok: true, synced: 0, total: count ?? 0, hasMore: false, nextPage: null });
            }

            // Envia para VPS em batch — sem imagens para evitar 413
            const vpsRows = products.map((p: any) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                status: p.status === 'active' ? 'active' : p.status,
                category_id: p.category_id,
                price_retail: p.price_retail,   // em centavos, igual ao Supabase
                price_reseller: p.price_reseller,
                price_wholesale: p.price_wholesale,
                price_cost: p.price_cost,
                stock_quantity: p.stock_quantity ?? 0,
                track_inventory: p.track_inventory ?? true,
                is_combo: p.is_combo ?? false,
                bling_id: p.bling_id ?? null,
                bling_parent_id: p.bling_parent_id ?? null,
                parent_id: p.parent_id ?? null,
            }));

            const batchRes = await fetch(`${vpsBase}/products/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
                body: JSON.stringify(vpsRows),
                signal: AbortSignal.timeout(25000),
            });

            const batchJson = batchRes.ok ? await batchRes.json() : { upserted: 0 };
            const hasMore = from + products.length < (count ?? 0);

            return res.status(200).json({
                ok: batchRes.ok,
                synced: batchJson.upserted ?? products.length,
                page,
                total: count ?? 0,
                hasMore,
                nextPage: hasMore ? page + 1 : null,
                vpsStatus: batchRes.status,
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }


    // ─── PRODUCT-UPDATE-FISCAL: atualiza NCM/CEST de um produto no Bling ────────
    // Body: { blingId: number, ncm?: string, cest?: string, origem?: number }
    // Busca o produto completo, faz merge apenas em tributacao e envia PUT.
    if (resource === 'reconcile') {
        if (req.method !== 'GET' && req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        if (!isBlingReconcileAuthorized(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const supabase = createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
            const dryRun = String(req.query?.dryRun || req.body?.dryRun || '').toLowerCase() === 'true';
            const accessToken = await getValidBlingAccessTokenForReconcile(supabase);

            const [localProducts, remoteProducts, remoteStocks] = await Promise.all([
                fetchAllLocalProductsForReconcile(supabase),
                fetchAllBlingProductsForReconcile(accessToken),
                fetchAllBlingStocksForReconcile(accessToken),
            ]);

            const plan = buildBlingReconcilePlan({
                localProducts,
                remoteProducts,
                remoteStocks,
            });

            if (dryRun) {
                return res.status(200).json({
                    ok: true,
                    dryRun: true,
                    planned: {
                        stockChanges: plan.stockChanges.length,
                        nameChanges: plan.nameChanges.length,
                    },
                    totals: plan.totals,
                });
            }

            const stockResult = await applyReconcileStockChanges(supabase, plan.stockChanges);
            const nameResult = await applyReconcileNameChanges(supabase, plan.nameChanges);

            return res.status(200).json({
                ok: true,
                totals: plan.totals,
                planned: {
                    stockChanges: plan.stockChanges.length,
                    nameChanges: plan.nameChanges.length,
                },
                applied: {
                    stockChanges: stockResult.applied.length,
                    nameChanges: nameResult.applied.length,
                },
                failed: [...stockResult.failed, ...nameResult.failed],
            });
        } catch (err: any) {
            console.error('[bling reconcile] fatal:', err?.message || err);
            return res.status(500).json({ ok: false, error: err?.message || 'Unknown error' });
        }
    }

    if (resource === 'product-update-fiscal') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        const { blingId, ncm, cest, origem } = req.body || {};
        if (!blingId) return res.status(400).json({ error: 'blingId required' });
        if (!ncm && !cest && origem === undefined) return res.status(400).json({ error: 'At least one of ncm, cest or origem required' });

        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: settings } = await supabase
                .from('company_settings')
                .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
                .single();
            if (!settings?.bling_access_token) return res.status(401).json({ error: 'Bling not connected' });

            // Refresh token if expired
            let accessToken = settings.bling_access_token;
            if (settings.bling_token_expires_at && new Date(settings.bling_token_expires_at) < new Date()) {
                const tokenRes = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.bling_refresh_token, client_id: settings.bling_client_id, client_secret: settings.bling_client_secret }),
                });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    accessToken = tokenData.access_token;
                    const { error: updateErr } = await supabase.from('company_settings').update({
                        bling_access_token: tokenData.access_token,
                        bling_refresh_token: tokenData.refresh_token,
                        bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
                    }).eq('id', settings.id);
                    if (updateErr) console.error('Token refresh (product-detail) update failed:', updateErr);
                }
            }

            // 1. Busca produto completo para não sobrescrever outros campos
            const prodRes = await fetch(`https://api.bling.com.br/Api/v3/produtos/${blingId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
            });
            if (!prodRes.ok) {
                return res.status(prodRes.status).json({ error: 'fetch_failed', detail: await prodRes.text() });
            }
            const prodData = await prodRes.json();
            const produto = prodData.data;

            // 2. Merge tributacao — somente campos informados
            const tributacaoAtual = produto.tributacao || {};
            const tributacaoNova: Record<string, any> = { ...tributacaoAtual };
            if (ncm !== undefined)    tributacaoNova.ncm    = ncm || null;
            if (cest !== undefined)   tributacaoNova.cest   = cest || null;
            if (origem !== undefined) tributacaoNova.origem = origem;

            const payload = { ...produto, tributacao: tributacaoNova };
            delete payload.estoque; // campo readonly — Bling rejeita se enviado

            // 3. PUT no Bling
            const putRes = await fetch(`https://api.bling.com.br/Api/v3/produtos/${blingId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!putRes.ok) {
                const detail = await putRes.text();
                return res.status(putRes.status).json({ ok: false, error: 'bling_update_failed', detail });
            }

            return res.status(200).json({ ok: true, blingId, ncm, cest });
        } catch (err: any) {
            return res.status(500).json({ error: 'network_error', message: err.message });
        }
    }

    return res.status(400).json({ error: 'Invalid resource. Valid: exchange|categories|products|product-detail|stock|stock-sync|webhook|finance|nfe|nfce|nf-detail|sync-prices-vps|product-update-fiscal|reconcile' });

}

