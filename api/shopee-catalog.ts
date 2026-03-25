import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

const SHOPEE_LIVE_URL = 'https://partner.shopeemobile.com';

function generateSign(partnerId: string, partnerKey: string, apiPath: string, timestamp: number, accessToken: string, shopId: string) {
    const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

async function getCredentials() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
        .from('company_settings')
        .select('shopee_partner_id, shopee_partner_key, shopee_access_token, shopee_shop_id')
        .limit(1)
        .single();
    if (!data?.shopee_partner_id || !data?.shopee_access_token) {
        throw new Error('Shopee não autenticada. Configure as credenciais no painel.');
    }
    return {
        partnerId: data.shopee_partner_id,
        partnerKey: data.shopee_partner_key,
        accessToken: data.shopee_access_token,
        shopId: data.shopee_shop_id,
    };
}

function buildShopeeUrl(apiPath: string, creds: ReturnType<typeof getCredentials> extends Promise<infer T> ? T : never) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(creds.partnerId, creds.partnerKey, apiPath, timestamp, creds.accessToken, creds.shopId);
    const base = `${SHOPEE_LIVE_URL}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&access_token=${creds.accessToken}&shop_id=${creds.shopId}&sign=${sign}`;
    return { url: base, timestamp, sign };
}

export default async function handler(req: any, res: any) {
    const action = req.query.action as string;

    try {
        const creds = await getCredentials();

        // GET /api/shopee-catalog?action=categories&keyword=...
        if (action === 'categories') {
            const apiPath = '/api/v2/product/get_category';
            const { url } = buildShopeeUrl(apiPath, creds);
            const lang = req.query.language || 'pt-BR';
            const r = await fetch(`${url}&language=${lang}`);
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // GET /api/shopee-catalog?action=attributes&category_id=...
        if (action === 'attributes') {
            const { category_id } = req.query;
            if (!category_id) return res.status(400).json({ error: 'category_id required' });
            const apiPath = '/api/v2/product/get_attributes';
            const { url } = buildShopeeUrl(apiPath, creds);
            const r = await fetch(`${url}&category_id=${category_id}&language=pt-BR`);
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // POST /api/shopee-catalog?action=add_item
        if (action === 'add_item') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const apiPath = '/api/v2/product/add_item';
            const { url } = buildShopeeUrl(apiPath, creds);
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // POST /api/shopee-catalog?action=update_price
        if (action === 'update_price') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const apiPath = '/api/v2/product/update_price';
            const { url } = buildShopeeUrl(apiPath, creds);
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // POST /api/shopee-catalog?action=update_stock
        if (action === 'update_stock') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const apiPath = '/api/v2/product/update_stock';
            const { url } = buildShopeeUrl(apiPath, creds);
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // POST /api/shopee-catalog?action=update_item_status (active/inactive)
        if (action === 'update_item_status') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const apiPath = '/api/v2/product/update_item_status';
            const { url } = buildShopeeUrl(apiPath, creds);
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // POST /api/shopee-catalog?action=update_item
        if (action === 'update_item') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const apiPath = '/api/v2/product/update_item';
            const { url } = buildShopeeUrl(apiPath, creds);
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // GET /api/shopee-catalog?action=get_item_list
        if (action === 'get_item_list') {
            const apiPath = '/api/v2/product/get_item_list';
            const { url } = buildShopeeUrl(apiPath, creds);
            const params = new URLSearchParams({
                offset: req.query.offset || '0',
                page_size: req.query.page_size || '100',
                item_status: req.query.item_status || 'NORMAL',
            });
            const r = await fetch(`${url}&${params}`);
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // GET /api/shopee-catalog?action=get_item_base_info&item_id_list=123,456,...
        if (action === 'get_item_base_info') {
            const rawIds = req.query.item_id_list as string;
            if (!rawIds) return res.status(400).json({ error: 'item_id_list required' });
            const apiPath = '/api/v2/product/get_item_base_info';
            const { url } = buildShopeeUrl(apiPath, creds);
            const r = await fetch(`${url}&item_id_list=${rawIds}&need_tax_info=true&need_complaint_policy=false`);
            const data = await r.json();
            return res.status(r.status).json(data);
        }

        // GET /api/shopee-catalog?action=debug — inspect raw API responses
        if (action === 'debug') {
            // Step 1: get item list (first 5 items)
            const listPath = '/api/v2/product/get_item_list';
            const { url: listUrl } = buildShopeeUrl(listPath, creds);
            const listR = await fetch(`${listUrl}&offset=0&page_size=5&item_status=NORMAL`);
            const listData = await listR.json();
            const itemIds: number[] = (listData.response?.item || []).map((i: any) => i.item_id);

            let baseInfoData: any = null;
            if (itemIds.length > 0) {
                const infoPath = '/api/v2/product/get_item_base_info';
                const { url: infoUrl } = buildShopeeUrl(infoPath, creds);
                const infoR = await fetch(`${infoUrl}&item_id_list=${itemIds.join(',')}&need_tax_info=false&need_complaint_policy=false`);
                baseInfoData = await infoR.json();
            }

            // Step 2: fetch 3 products from VPS to inspect field names
            const vpsR = await fetch('https://api.xiaomipetrolina.com.br/products?limit=3&status=all');
            const vpsData = vpsR.ok ? await vpsR.json() : null;
            const vpsFirstItem = Array.isArray(vpsData) ? vpsData[0] : null;
            const skuSamples = Array.isArray(vpsData)
                ? vpsData.slice(0, 5).map((p: any) => ({ id: p.id, sku: p.sku, codigo: p.codigo, name: p.name }))
                : 'VPS fetch failed';

            return res.status(200).json({
                shopee_skus_sample: (baseInfoData?.response?.item_list || []).slice(0, 5).map((i: any) => ({
                    item_id: i.item_id,
                    item_sku: i.item_sku,
                    item_name: i.item_name?.slice(0, 40),
                })),
                vps_field_keys: vpsFirstItem ? Object.keys(vpsFirstItem) : 'fetch failed',
                vps_sku_samples: skuSamples,
                get_item_list_total: listData.response?.total_count,
            });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });

    } catch (err: any) {
        console.error('[shopee-catalog]', err);
        return res.status(500).json({ error: err.message });
    }
}
