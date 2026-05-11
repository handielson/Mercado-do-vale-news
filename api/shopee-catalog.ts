import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

const SHOPEE_API_LIVE_URL = 'https://partner.shopeemobile.com';
const SHOPEE_API_SANDBOX_URL = 'https://partner.test-stable.shopeemobile.com';

function getShopeeBaseUrl(partnerId: string | number) {
    if (String(partnerId) === '1229870' || process.env.SHOPEE_ENV === 'sandbox') {
        return SHOPEE_API_SANDBOX_URL;
    }
    return SHOPEE_API_LIVE_URL;
}

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

function firstString(...values: any[]): string {
    for (const v of values) {
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
}

function isNoGtinValue(value: string): boolean {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');
    return normalized === 'SEM GTIN' || normalized === 'SEM_GTIN' || normalized === 'NAO POSSUI' || normalized === 'ISENTO';
}

function normalizeLookupText(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function extractShopeeBrandList(data: any): any[] {
    if (Array.isArray(data?.response?.brand_list)) return data.response.brand_list;
    if (Array.isArray(data?.response?.list)) return data.response.list;
    return [];
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
    const matches = String(dataUrl || '').match(/^data:([^;]+);base64,(.*)$/);
    if (!matches) return null;
    return {
        mimeType: matches[1],
        buffer: Buffer.from(matches[2], 'base64'),
    };
}

async function resolveMediaInput(dataUrl: string, remoteUrl: string, expectedPrefix: 'image/' | 'video/'): Promise<{ mimeType: string; buffer: Buffer; fileNameHint: string } | null> {
    if (dataUrl) {
        const parsed = parseDataUrl(dataUrl);
        if (!parsed || !parsed.mimeType.startsWith(expectedPrefix)) {
            return null;
        }
        const ext = parsed.mimeType.split('/')[1] || (expectedPrefix === 'image/' ? 'jpg' : 'mp4');
        return { mimeType: parsed.mimeType, buffer: parsed.buffer, fileNameHint: `upload.${ext}` };
    }

    if (remoteUrl) {
        const remoteRes = await fetch(remoteUrl);
        if (!remoteRes.ok) {
            throw new Error(`Falha ao baixar midia remota: ${remoteRes.status}`);
        }
        const mimeType = remoteRes.headers.get('content-type') || (expectedPrefix === 'image/' ? 'image/jpeg' : 'video/mp4');
        if (!mimeType.startsWith(expectedPrefix)) {
            return null;
        }
        const arrayBuffer = await remoteRes.arrayBuffer();
        const fileNameHint = remoteUrl.split('/').pop() || `upload.${mimeType.split('/')[1] || 'bin'}`;
        return { mimeType, buffer: Buffer.from(arrayBuffer), fileNameHint };
    }

    return null;
}

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
    const shopeeBaseUrl = getShopeeBaseUrl(creds.partnerId);
    const url = `${shopeeBaseUrl}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&sign=${sign}`;
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
    const shopeeBaseUrl = getShopeeBaseUrl(creds.partnerId);
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(creds.partnerId, creds.partnerKey, apiPath, timestamp, creds.accessToken, creds.shopId);
    const base = `${shopeeBaseUrl}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&access_token=${creds.accessToken}&shop_id=${creds.shopId}&sign=${sign}`;
    return { url: base, timestamp, sign };
}

// Fetch wrapper: auto-refresh on invalid token, retry once
async function shopeeGet(apiPath: string, creds: Creds, extraParams: string): Promise<any> {
    const { url } = buildShopeeUrl(apiPath, creds);
    const r = await fetch(`${url}${extraParams}`);
    const data = await r.json();
    if ((data.error === 'invalid_access_token' || data.error === 'invalid_acceess_token' || data.error === 'error_auth') && creds.refreshToken) {
        creds.accessToken = await doRefreshToken(creds);
        const { url: url2 } = buildShopeeUrl(apiPath, creds);
        const r2 = await fetch(`${url2}${extraParams}`);
        return r2.json();
    }
    return data;
}

async function shopeePost(apiPath: string, creds: Creds, body: any, extraParams = ''): Promise<any> {
    const { url } = buildShopeeUrl(apiPath, creds);
    const r = await fetch(`${url}${extraParams}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if ((data.error === 'invalid_access_token' || data.error === 'invalid_acceess_token' || data.error === 'error_auth') && creds.refreshToken) {
        creds.accessToken = await doRefreshToken(creds);
        const { url: url2 } = buildShopeeUrl(apiPath, creds);
        const r2 = await fetch(`${url2}${extraParams}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return r2.json();
    }
    return data;
}

async function shopeeMultipart(apiPath: string, creds: Creds, formData: FormData): Promise<any> {
    const { url } = buildShopeeUrl(apiPath, creds);
    const r = await fetch(url, { method: 'POST', body: formData as any });
    const data = await r.json();
    if ((data.error === 'invalid_access_token' || data.error === 'invalid_acceess_token' || data.error === 'error_auth') && creds.refreshToken) {
        creds.accessToken = await doRefreshToken(creds);
        const { url: url2 } = buildShopeeUrl(apiPath, creds);
        const r2 = await fetch(url2, { method: 'POST', body: formData as any });
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
        if (action === 'search_attribute_values') {
            const attributeId = Number(req.query.attribute_id);
            if (!Number.isFinite(attributeId) || attributeId <= 0) {
                return res.status(400).json({ error: 'attribute_id required' });
            }
            const cursorRaw = Number(req.query.cursor ?? 0);
            const cursor = Number.isFinite(cursorRaw) && cursorRaw >= 0 ? cursorRaw : 0;
            const limitRaw = Number(req.query.limit ?? 100);
            const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 100;
            const valueName = String(req.query.value_name ?? '').trim();

            const params = new URLSearchParams({
                attribute_id: String(attributeId),
                cursor: String(cursor),
                limit: String(limit),
            });
            if (valueName) params.set('value_name', valueName);

            const data = await shopeePost('/api/v2/product/search_attribute_value_list', creds, {}, `&${params}`);
            return res.status(200).json(data);
        }
        if (action === 'brand_list') {
            const categoryId = Number(req.query.category_id);
            if (!Number.isFinite(categoryId) || categoryId <= 0) {
                return res.status(400).json({ error: 'category_id required' });
            }

            const pageSizeRaw = Number(req.query.page_size ?? 100);
            const pageSize = Number.isFinite(pageSizeRaw) ? Math.max(1, Math.min(100, pageSizeRaw)) : 100;
            const offsetRaw = Number(req.query.offset ?? 0);
            const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
            const brandName = String(req.query.brand_name || '').trim();
            const targetBrand = normalizeLookupText(brandName);

            const fetchBrandPage = (nextOffset: number) => {
                const params = new URLSearchParams({
                    category_id: String(categoryId),
                    status: String(req.query.status ?? 1),
                    offset: String(nextOffset),
                    page_size: String(pageSize),
                });
                return shopeeGet('/api/v2/product/get_brand_list', creds, `&${params}`);
            };

            if (!targetBrand) {
                return res.status(200).json(await fetchBrandPage(offset));
            }

            const collected: any[] = [];
            let nextOffset = 0;
            for (let attempt = 0; attempt < 20; attempt += 1) {
                const data = await fetchBrandPage(nextOffset);
                if (data?.error && data.error !== '') return res.status(200).json(data);

                const pageBrands = extractShopeeBrandList(data);
                collected.push(...pageBrands);

                const exactMatches = collected.filter((brand: any) => {
                    const label = firstString(brand?.display_brand_name, brand?.brand_name, brand?.name, brand?.original_brand_name);
                    const original = firstString(brand?.original_brand_name, brand?.brand_name, brand?.name);
                    return normalizeLookupText(label) === targetBrand || normalizeLookupText(original) === targetBrand;
                });

                if (exactMatches.length > 0) {
                    return res.status(200).json({
                        error: '',
                        message: '',
                        response: {
                            brand_list: exactMatches,
                            total_count: exactMatches.length,
                        },
                    });
                }

                const hasNext = data?.response?.has_next_page === true || pageBrands.length >= pageSize;
                if (!hasNext) break;
                nextOffset += pageSize;
            }

            return res.status(200).json({
                error: '',
                message: '',
                response: {
                    brand_list: collected.slice(0, pageSize),
                    total_count: collected.length,
                },
            });
        }
        if (action === 'shop_info') {
            const data = await shopeeGet('/api/v2/shop/get_shop_info', creds, '');
            return res.status(200).json(data);
        }
        if (action === 'logistics_channel_list') {
            const data = await shopeeGet('/api/v2/logistics/get_channel_list', creds, '');
            return res.status(200).json(data);
        }
        if (action === 'warehouse_list') {
            const data = await shopeeGet('/api/v2/inventory/get_warehouse_list', creds, '');
            return res.status(200).json(data);
        }
        if (action === 'warehouse_detail') {
            const warehouseTypeRaw = Number(req.query.warehouse_type ?? 1);
            const warehouseType = Number.isFinite(warehouseTypeRaw) && warehouseTypeRaw > 0 ? warehouseTypeRaw : 1;
            const data = await shopeeGet('/api/v2/shop/get_warehouse_detail', creds, `&warehouse_type=${warehouseType}`);
            return res.status(200).json(data);
        }
        if (action === 'warehouse_locations') {
            const merchantId = String(req.query.merchant_id || '').trim();
            const extraParams = merchantId ? `&merchant_id=${encodeURIComponent(merchantId)}` : '';
            const data = await shopeeGet('/api/v2/merchant/get_merchant_warehouse_location_list', creds, extraParams);
            return res.status(200).json(data);
        }
        if (action === 'add_item') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            return res.status(200).json(await shopeePost('/api/v2/product/add_item', creds, req.body));
        }
        if (action === 'update_price') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
            const incoming = (req.body && typeof req.body === 'object') ? { ...req.body } : {};
            const itemId = Number(incoming.item_id);
            const incomingPriceList = Array.isArray(incoming.price_list) ? incoming.price_list : [];

            if (!Number.isFinite(itemId) || itemId <= 0) {
                return res.status(400).json({ error: 'item_id required' });
            }
            if (incomingPriceList.length === 0) {
                return res.status(400).json({ error: 'price_list required' });
            }

            const detailData = await shopeeGet(
                '/api/v2/product/get_item_base_info',
                creds,
                `&item_id_list=${itemId}&need_tax_info=false&need_complaint_policy=false`
            );
            const currentItem = detailData?.response?.item_list?.[0] || null;
            const hasModel = currentItem?.has_model === true || currentItem?.has_model === 1 || currentItem?.has_model === '1';

            let pricePayload = {
                item_id: itemId,
                price_list: incomingPriceList,
            } as Record<string, any>;

            // Compatibilidade com UI atual: model_id=0 significa item simples.
            // Se houver variações, sempre substituímos por model_id reais.
            const hasZeroModel = incomingPriceList.some((p: any) => Number(p?.model_id) === 0);
            if (hasModel || hasZeroModel) {
                const modelListData = await shopeeGet('/api/v2/product/get_model_list', creds, `&item_id=${itemId}`);
                const modelList = modelListData?.response?.model || [];
                const modelIds = modelList
                    .map((m: any) => Number(m?.model_id))
                    .filter((id: number) => Number.isFinite(id) && id > 0);

                if (modelIds.length > 0) {
                    const firstPrice = incomingPriceList.find((p: any) => p && Number(p.original_price) > 0);
                    const fallbackPrice = Number(firstPrice?.original_price);
                    const incomingByModel = new Map<number, number>();

                    for (const row of incomingPriceList) {
                        const modelId = Number(row?.model_id);
                        const price = Number(row?.original_price);
                        if (Number.isFinite(modelId) && modelId > 0 && Number.isFinite(price) && price > 0) {
                            incomingByModel.set(modelId, price);
                        }
                    }

                    const expandedPriceList = modelIds
                        .map((modelId: number) => ({
                            model_id: modelId,
                            original_price: Number(incomingByModel.get(modelId) ?? fallbackPrice),
                        }))
                        .filter((row: any) => Number.isFinite(row.original_price) && row.original_price > 0);

                    if (expandedPriceList.length > 0) {
                        pricePayload.price_list = expandedPriceList;
                    }
                }
            }

            return res.status(200).json(await shopeePost('/api/v2/product/update_price', creds, pricePayload));
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
            const incoming = (req.body && typeof req.body === 'object') ? { ...req.body } : {};
            const itemId = Number(incoming.item_id);

            if (!Number.isFinite(itemId) || itemId <= 0) {
                return res.status(400).json({ error: 'item_id required' });
            }

            // Em updates parciais (ex.: só nome), preserva dados fiscais já existentes na Shopee.
            // Isso evita erro "GTIN code is mandatory" quando a categoria exige GTIN.
            const detailData = await shopeeGet(
                '/api/v2/product/get_item_base_info',
                creds,
                `&item_id_list=${itemId}&need_tax_info=true&need_complaint_policy=false`
            );

            const currentItem = detailData?.response?.item_list?.[0] || null;
            const currentDim = currentItem?.dimension || {};
            const hasModel = currentItem?.has_model === true;
            const currentTax = (currentItem?.tax_info && typeof currentItem.tax_info === 'object')
                ? { ...currentItem.tax_info }
                : {};

            const incomingTax = (incoming.tax_info && typeof incoming.tax_info === 'object')
                ? { ...incoming.tax_info }
                : {};

            const incomingGtinCandidate = firstString(incomingTax.gtin, incoming.gtin_code);
            const noGtinSelected = isNoGtinValue(incomingGtinCandidate);

            const resolvedGtin = noGtinSelected
                ? 'SEM GTIN'
                : firstString(
                    incomingTax.gtin,
                    incoming.gtin_code,
                    currentTax.gtin,
                    currentItem?.gtin_code,
                    currentItem?.gtin,
                    currentItem?.ean
                );

            const mergedTax: Record<string, any> = {
                ...currentTax,
                ...incomingTax,
            };

            if (resolvedGtin) {
                mergedTax.gtin = resolvedGtin;
                incoming.gtin_code = resolvedGtin;
            }

            // Em itens com variação, a regra de GTIN pode ser aplicada no nível de modelo.
            // Nesses casos, enviamos o gtin_code para todos os modelos antes do update_item.
            if (hasModel && resolvedGtin) {
                const modelListData = await shopeeGet('/api/v2/product/get_model_list', creds, `&item_id=${itemId}`);
                const modelList = modelListData?.response?.model || [];

                if (Array.isArray(modelList) && modelList.length > 0) {
                    const modelPayload = {
                        item_id: itemId,
                        model: modelList
                            .filter((m: any) => m?.model_id != null)
                            .map((m: any) => ({
                                model_id: m.model_id,
                                gtin_code: resolvedGtin,
                            })),
                    };

                    if (modelPayload.model.length > 0) {
                        const modelUpdate = await shopeePost('/api/v2/product/update_model', creds, modelPayload);
                        if (modelUpdate?.error && modelUpdate.error !== '') {
                            return res.status(200).json(modelUpdate);
                        }
                    }
                }
            }

            const payload = {
                ...incoming,
                item_id: itemId,
                // Preserva campos comuns quando a UI manda update parcial
                condition: incoming.condition ?? currentItem?.condition,
                item_sku: incoming.item_sku ?? currentItem?.item_sku,
                item_weight: incoming.item_weight ?? currentItem?.weight,
                package_length: incoming.package_length ?? currentDim.package_length,
                package_width: incoming.package_width ?? currentDim.package_width,
                package_height: incoming.package_height ?? currentDim.package_height,
                tax_info: Object.keys(mergedTax).length > 0 ? mergedTax : undefined,
            } as Record<string, any>;

            if (!payload.tax_info) {
                delete payload.tax_info;
            }
            if (!payload.gtin_code) {
                delete payload.gtin_code;
            }

            return res.status(200).json(await shopeePost('/api/v2/product/update_item', creds, payload));
        }
        if (action === 'upload_image') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

            const imageDataUrl = String(req.body?.image_data_url || '');
            const imageUrl = String(req.body?.image_url || '');
            const parsed = await resolveMediaInput(imageDataUrl, imageUrl, 'image/');
            if (!parsed) {
                return res.status(400).json({ error: 'invalid image_data_url' });
            }

            const ext = parsed.mimeType.split('/')[1] || 'jpg';
            const fileName = String(req.body?.file_name || parsed.fileNameHint || `image_${Date.now()}.${ext}`);

            const formData = new FormData();
            formData.append('image', new Blob([new Uint8Array(parsed.buffer)], { type: parsed.mimeType }), fileName);

            const upload = await shopeeMultipart('/api/v2/media_space/upload_image', creds, formData);
            return res.status(200).json(upload);
        }
        if (action === 'upload_video') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

            const videoDataUrl = String(req.body?.video_data_url || '');
            const videoUrl = String(req.body?.video_url || '');
            const parsed = await resolveMediaInput(videoDataUrl, videoUrl, 'video/');
            if (!parsed) {
                return res.status(400).json({ error: 'invalid video input' });
            }

            const ext = parsed.mimeType.split('/')[1] || 'mp4';
            const fileName = String(req.body?.file_name || parsed.fileNameHint || `video_${Date.now()}.${ext}`);

            const formData = new FormData();
            formData.append('video', new Blob([new Uint8Array(parsed.buffer)], { type: parsed.mimeType }), fileName);

            const upload = await shopeeMultipart('/api/v2/media_space/upload_video', creds, formData);
            if (upload?.error && upload.error !== '') {
                return res.status(200).json(upload);
            }

            const directVideoId = firstString(
                upload?.response?.video_id,
                upload?.response?.video_info?.video_id,
                upload?.response?.video_info_list?.[0]?.video_id,
                upload?.response?.video_list?.[0]?.video_id,
            );

            if (directVideoId) {
                return res.status(200).json({ error: '', message: '', response: { video_id: directVideoId } });
            }

            const uploadId = firstString(
                upload?.response?.video_upload_id,
                upload?.response?.video_upload_id_list?.[0],
                upload?.response?.upload_id,
                upload?.response?.upload_id_list?.[0],
            );

            if (!uploadId) {
                return res.status(200).json({
                    error: 'video_upload_id_not_found',
                    message: 'Shopee não retornou video_upload_id no upload de vídeo',
                    response: upload?.response,
                });
            }

            const maxAttempts = 12;
            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const result = await shopeePost('/api/v2/media_space/get_video_upload_result', creds, { video_upload_id: uploadId });

                const resolvedVideoId = firstString(
                    result?.response?.video_id,
                    result?.response?.video_info?.video_id,
                    result?.response?.video_info_list?.[0]?.video_id,
                    result?.response?.video_list?.[0]?.video_id,
                );

                if (resolvedVideoId) {
                    return res.status(200).json({ error: '', message: '', response: { video_id: resolvedVideoId } });
                }

                if (result?.error && result.error !== '') {
                    const msg = String(result?.message || '').toLowerCase();
                    const waitable = msg.includes('invalid or expired vid') || msg.includes('request vid is abnormal');
                    if (!waitable) {
                        return res.status(200).json(result);
                    }
                }
            }

            return res.status(408).json({
                error: 'video_upload_timeout',
                message: 'Upload do vídeo ainda em processamento. Tente salvar novamente em alguns segundos.',
                response: { video_upload_id: uploadId },
            });
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
        if (action === 'get_model_list') {
            const itemId = Number(req.query.item_id);
            if (!Number.isFinite(itemId) || itemId <= 0) return res.status(400).json({ error: 'item_id required' });
            return res.status(200).json(
                await shopeeGet('/api/v2/product/get_model_list', creds, `&item_id=${itemId}`)
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

