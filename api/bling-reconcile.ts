import { createClient } from '@supabase/supabase-js';
import { buildBlingReconcilePlan } from './_lib/bling-reconcile-core.js';

const BLING_API_BASE = 'https://api.bling.com.br/Api/v3';
const VPS_BASE_URL = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const VPS_SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const DEFAULT_PAGE_SIZE = 100;
const LOCAL_PAGE_SIZE = 1000;

function isAuthorized(req: any): boolean {
    const authHeader = String(req.headers?.authorization || '');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        return authHeader === `Bearer ${cronSecret}`;
    }

    const syncHeader = String(req.headers?.['x-sync-key'] || req.headers?.['x-api-key'] || '');
    if (VPS_SYNC_KEY && syncHeader === VPS_SYNC_KEY) {
        return true;
    }

    const userAgent = String(req.headers?.['user-agent'] || '');
    return userAgent.includes('vercel-cron/1.0');
}

async function getValidBlingAccessToken(supabase: any) {
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

    const tokenRes = await fetch(`${BLING_API_BASE}/oauth/token`, {
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

    const detail = await tokenRes.text();
    throw new Error(`Bling token refresh failed (${tokenRes.status}): ${detail}`);
}

async function fetchAllLocalProducts(supabase: any) {
    const localProducts: any[] = [];

    for (let from = 0; ; from += LOCAL_PAGE_SIZE) {
        const to = from + LOCAL_PAGE_SIZE - 1;
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

        if (rows.length < LOCAL_PAGE_SIZE) {
            break;
        }
    }

    return localProducts;
}

async function fetchAllBlingProducts(accessToken: string) {
    const remoteProducts: any[] = [];

    for (let page = 1; ; page += 1) {
        const res = await fetch(`${BLING_API_BASE}/produtos?pagina=${page}&limite=${DEFAULT_PAGE_SIZE}&criterio=5`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            throw new Error(`Bling products fetch failed (${res.status}): ${await res.text()}`);
        }

        const json = await res.json();
        const pageItems = Array.isArray(json?.data) ? json.data : [];
        remoteProducts.push(...pageItems);

        if (pageItems.length < DEFAULT_PAGE_SIZE) {
            break;
        }
    }

    return remoteProducts;
}

async function fetchAllBlingStocks(accessToken: string) {
    const remoteStocks: any[] = [];

    for (let page = 1; ; page += 1) {
        const res = await fetch(`${BLING_API_BASE}/estoques/saldos?pagina=${page}&limite=${DEFAULT_PAGE_SIZE}`, {
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

        if (pageItems.length < DEFAULT_PAGE_SIZE) {
            break;
        }
    }

    return remoteStocks;
}

async function patchVps(path: string, body: object): Promise<boolean> {
    if (!VPS_SYNC_KEY) return false;

    try {
        const res = await fetch(`${VPS_BASE_URL}${path}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-sync-key': VPS_SYNC_KEY,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        });

        return res.ok;
    } catch {
        return false;
    }
}

async function applyStockChanges(supabase: any, changes: any[]) {
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

        const vpsUpdated = await patchVps(
            '/products/stock',
            change.blingId
                ? { bling_id: change.blingId, stock_quantity: change.nextStock }
                : { sku: change.sku, stock_quantity: change.nextStock },
        );

        applied.push({ ...change, vpsUpdated });
    }

    return { applied, failed };
}

async function applyNameChanges(supabase: any, changes: any[]) {
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
            ? await patchVps('/products/name', { sku: change.sku, name: change.nextName })
            : false;

        applied.push({ ...change, vpsUpdated });
    }

    return { applied, failed };
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: 'Supabase credentials missing from environment' });
    }

    const dryRun = String(req.query?.dryRun || req.body?.dryRun || '').toLowerCase() === 'true';
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
        const accessToken = await getValidBlingAccessToken(supabase);

        const [localProducts, remoteProducts, remoteStocks] = await Promise.all([
            fetchAllLocalProducts(supabase),
            fetchAllBlingProducts(accessToken),
            fetchAllBlingStocks(accessToken),
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

        const stockResult = await applyStockChanges(supabase, plan.stockChanges);
        const nameResult = await applyNameChanges(supabase, plan.nameChanges);

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
        console.error('[bling-reconcile] fatal:', err?.message || err);
        return res.status(500).json({ ok: false, error: err?.message || 'Unknown error' });
    }
}
