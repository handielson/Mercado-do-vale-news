import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

const SHOPEE_LIVE_URL = 'https://partner.shopeemobile.com';

// Sign for shop-level APIs (access_token + shop_id in base string)
function generateSign(partnerId: string, partnerKey: string, apiPath: string, timestamp: number, accessToken: string, shopId: string) {
    const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

// Sign for public/auth APIs (no access_token, no shop_id)
function generatePublicSign(partnerId: string, partnerKey: string, apiPath: string, timestamp: number) {
    const baseString = `${partnerId}${apiPath}${timestamp}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

type Creds = {
    partnerId: string; partnerKey: string; accessToken: string;
    shopId: string; refreshToken: string | null;
};

async function getCredentials(): Promise<Creds> {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
        .from('company_settings')
        .select('shopee_partner_id, shopee_partner_key, shopee_access_token, shopee_shop_id, shopee_refresh_token')
        .limit(1)
        .single();
    if (!data?.shopee_partner_id || !data?.shopee_access_token) {
        throw new Error('Shopee nÃ£o autenticada. Configure as credenciais no painel.');
    }
    return {
        partnerId: data.shopee_partner_id,
        partnerKey: data.shopee_partner_key,
        accessToken: data.shopee_access_token,
        shopId: data.shopee_shop_id,
        refreshToken: data.shopee_refresh_token || null,
    };
}

async function doRefreshToken(creds: Creds): Promise<string> {
    if (!creds.refreshToken) throw new Error('refresh_token nÃ£o disponÃ­vel. Reconecte Ã  Shopee.');
    const apiPath = '/api/v2/auth/access_token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generatePublicSign(creds.partnerId, creds.partnerKey, apiPath, timestamp);
    const url = `${SHOPEE_LIVE_URL}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&sign=${sign}`;
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            partner_id: parseInt(creds.partnerId),
            shop_id: parseInt(creds.shopId),
            refresh_token: creds.refreshToken,
        }),
    });
    const data = await r.json();
    if (data.error || !data.access_token) throw new Error(`Refresh falhou: ${data.message || data.error}`);
    // Save new tokens to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('company_settings').update({
        shopee_access_token: data.access_token,
        shopee_refresh_token: data.refresh_token || creds.refreshToken,
    }).not('shopee_partner_id', 'is', null);
    console.log('[shopee-catalog] Token renovado com sucesso');
    return data.access_token;
}

function buildShopeeUrl(apiPath: string, creds: Creds) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(creds.partnerId, creds.partnerKey, apiPath, timestamp, creds.accessToken, creds.shopId);
    const base = `${SHOPEE_LIVE_URL}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&access_token=${creds.accessToken}&shop_id=${creds.shopId}&sign=${sign}`;
    return { url: base, timestamp, sign };
}

// Fetch wrapper: auto-refresh on invalid token, retry once
async function shopeeGet(apiPath: string, creds: Creds, extraParams: string): Promise<any> {
    const { url } = buildShopeeUrl(apiPath, creds);
    const r = await fetch(`${url}${extraParams}`);
    const data = await r.json();
    if ((data.error === 'invalid_access_token' || data.error === 'error_auth') && creds.refreshToken) {
        creds.accessToken = await doRefreshToken(creds);
        const { url: url2 } = buildShopeeUrl(apiPath, creds);
        const r2 = await fetch(`${url2}${extraParams}`);
        return r2.json();
    }
    return data;
}

async function shopeePost(apiPath: string, creds: Creds, body: any): Promise<any> {
    const { url } = buildShopeeUrl(apiPath, creds);
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if ((data.error === 'invalid_access_token' || data.error === 'error_auth') && creds.refreshToken) {
        creds.accessToken = await doRefreshToken(creds);
        const { url: url2 } = buildShopeeUrl(apiPath, creds);
        const r2 = await fetch(url2, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return r2.json();
    }
    return data;
}

export default async function handler(req: any, res: any) {
    const action = req.query.action as string;
    try {
        const creds = await getCredentials();

        if (action === 'categories') {
            const lang = req.query.language || 'pt-BR';
            const data = await shopeeGet('/api/v2/product/get_category', creds, `&language=${lang}`);
            return res.status(200).json(data);
        }
        if (action === 'attributes') {
            const { category_id } = req.query;
            if (!category_id) return res.status(400).json({ error: 'category_id required' });
            const data = await shopeeGet('/api/v2/product/get_attribute_tree', creds, `&category_id_list=${category_id}&language=pt-BR`);
            return res.status(200).json(data);
        }
        if (action === 'add_item') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            return res.status(200).json(await shopeePost('/api/v2/product/add_item', creds, req.body));
        }
        if (action === 'update_price') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            return res.status(200).json(await shopeePost('/api/v2/product/update_price', creds, req.body));
        }
        if (action === 'update_stock') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            return res.status(200).json(await shopeePost('/api/v2/product/update_stock', creds, req.body));
        }
        if (action === 'update_item_status') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            return res.status(200).json(await shopeePost('/api/v2/product/update_item_status', creds, req.body));
        }
        if (action === 'update_item') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            return res.status(200).json(await shopeePost('/api/v2/product/update_item', creds, req.body));
        }
        if (action === 'get_full_catalog') {
            const pageSizeRaw = Number(req.query.page_size || 100);
            const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.min(100, pageSizeRaw)) : 100;
            const itemStatus = String(req.query.item_status || 'NORMAL');

            const allItemIds: number[] = [];
            let offset = 0;
            let hasNextPage = true;
            let safety = 0;

            while (hasNextPage && safety < 200) {
                const params = new URLSearchParams({
                    offset: String(offset),
                    page_size: String(pageSize),
                    item_status: itemStatus,
                });
                const listData = await shopeeGet('/api/v2/product/get_item_list', creds, `&${params}`);
                if (listData?.error && listData.error !== '') {
                    return res.status(200).json(listData);
                }

                const pageItems: any[] = listData?.response?.item || [];
                for (const item of pageItems) {
                    if (item?.item_id != null) allItemIds.push(Number(item.item_id));
                }

                hasNextPage = listData?.response?.has_next_page === true;
                offset = Number(listData?.response?.next_offset ?? (offset + pageSize));
                if (pageItems.length === 0) break;
                safety += 1;
            }

            const uniqueIds = [...new Set(allItemIds)].filter((id) => Number.isFinite(id));
            const itemList: any[] = [];
            const detailBatch = 50;

            for (let i = 0; i < uniqueIds.length; i += detailBatch) {
                const batchIds = uniqueIds.slice(i, i + detailBatch).join(',');
                const detailData = await shopeeGet(
                    '/api/v2/product/get_item_base_info',
                    creds,
                    `&item_id_list=${batchIds}&need_tax_info=true&need_complaint_policy=false`
                );

                if (detailData?.error && detailData.error !== '') {
                    return res.status(200).json(detailData);
                }

                itemList.push(...(detailData?.response?.item_list || []));
            }

            return res.status(200).json({
                error: '',
                message: 'success',
                response: {
                    total_count: uniqueIds.length,
                    item_list: itemList,
                },
            });
        }
        if (action === 'get_item_list') {
            const params = new URLSearchParams({
                offset: req.query.offset || '0',
                page_size: req.query.page_size || '100',
                item_status: req.query.item_status || 'NORMAL',
            });
            return res.status(200).json(await shopeeGet('/api/v2/product/get_item_list', creds, `&${params}`));
        }
        if (action === 'get_item_base_info') {
            const rawIds = req.query.item_id_list as string;
            if (!rawIds) return res.status(400).json({ error: 'item_id_list required' });
            return res.status(200).json(
                await shopeeGet('/api/v2/product/get_item_base_info', creds, `&item_id_list=${rawIds}&need_tax_info=true&need_complaint_policy=false`)
            );
        }
        if (action === 'debug') {
            const listData = await shopeeGet('/api/v2/product/get_item_list', creds, '&offset=0&page_size=5&item_status=NORMAL');
            const itemIds: number[] = (listData.response?.item || []).map((i: any) => i.item_id);
            let baseInfoData: any = null;
            if (itemIds.length > 0) {
                baseInfoData = await shopeeGet('/api/v2/product/get_item_base_info', creds,
                    `&item_id_list=${itemIds.join(',')}&need_tax_info=true&need_complaint_policy=false`);
            }
            const vpsR = await fetch('https://api.xiaomipetrolina.com.br/products?limit=3&status=all');
            const vpsData = vpsR.ok ? await vpsR.json() : null;
            const vpsFirstItem = Array.isArray(vpsData) ? vpsData[0] : null;
            return res.status(200).json({
                shopee_item_sample: (baseInfoData?.response?.item_list || []).slice(0, 2).map((i: any) => ({
                    item_id: i.item_id, item_name: i.item_name?.slice(0, 40),
                    weight: i.weight, dimension: i.dimension, tax_info: i.tax_info,
                    description_len: i.description?.length,
                })),
                vps_field_keys: vpsFirstItem ? Object.keys(vpsFirstItem) : 'fetch failed',
                get_item_list_total: listData.response?.total_count,
            });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
        console.error('[shopee-catalog]', err);
        return res.status(500).json({ error: err.message });
    }
}

