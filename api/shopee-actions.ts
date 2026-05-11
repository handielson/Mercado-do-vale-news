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
function generateSign(partnerId: string, partnerKey: string, apiPath: string, timestamp: number, accessToken: string, shopId: string) {
    const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

function firstNonEmpty(...values: any[]): string {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        const normalized = String(value).trim();
        if (normalized) return normalized;
    }
    return '';
}

function isRetryableShopeeError(data: any): boolean {
    const normalized = String(data?.error || data?.message || '').toLowerCase();
    return (
        normalized.includes('timeout') ||
        normalized.includes('temporar') ||
        normalized.includes('system_busy') ||
        normalized.includes('too many') ||
        normalized.includes('rate')
    );
}

async function sleep(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const query = req.query && typeof req.query === 'object' ? req.query : {};
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const actionRaw = req.method === 'GET' ? query.action : body.action;
    const action = typeof actionRaw === 'string' ? actionRaw.trim() : '';
    if (!action) {
        return res.status(400).json({ error: 'action obrigatória' });
    }

    const payload = req.method === 'GET' ? query : (body.payload ?? body);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações da empresa primariamente pelo VPS
    let settings = null;
    try {
        const vpsUrl = process.env.VITE_VPS_URL || 'https://api.xiaomipetrolina.com.br';
        const vpsRes = await fetch(`${vpsUrl}/company-settings`, {
            headers: { 'x-sync-key': process.env.VPS_SYNC_KEY || '' }
        });
        if (vpsRes.ok) {
            settings = await vpsRes.json();
        }
    } catch (e) {
        console.error('Erro ao buscar do VPS:', e);
    }

    const { data: supabaseSettings } = await supabase
        .from('company_settings')
        .select('id, shopee_partner_id, shopee_partner_key, shopee_shop_id, shopee_access_token, shopee_refresh_token')
        .limit(1)
        .single();

    settings = { ...settings, ...supabaseSettings };
    if (supabaseSettings?.id) {
        settings.id = supabaseSettings.id;
    }

    if (!settings?.shopee_access_token || !settings?.shopee_shop_id) {
        return res.status(401).json({ error: 'Shopee não conectada ou sem token' });
    }

    const partnerId = settings.shopee_partner_id;
    const partnerKey = settings.shopee_partner_key;
    const shopId = settings.shopee_shop_id;
    const accessToken = settings.shopee_access_token;

    try {
        const shopeeApiUrl = getShopeeBaseUrl(partnerId);
        const buildSignedUrl = (apiPath: string, extraParams = '') => {
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
            return `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}${extraParams}`;
        };

        const shopeeGetSigned = async (apiPath: string, extraParams = '') => {
            const r = await fetch(buildSignedUrl(apiPath, extraParams));
            return r.json();
        };

        const shopeePostSigned = async (apiPath: string, body: any, retries = 2) => {
            let lastError: any = null;

            for (let attempt = 0; attempt <= retries; attempt += 1) {
                try {
                    const r = await fetch(buildSignedUrl(apiPath), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await r.json();
                    if (!data?.error || !isRetryableShopeeError(data) || attempt === retries) {
                        return data;
                    }
                    lastError = data;
                } catch (error) {
                    lastError = error;
                    if (attempt === retries) throw error;
                }

                await sleep(500 * (attempt + 1));
            }

            return lastError;
        };

        if (action === 'refresh_token') {
            if (!settings?.shopee_refresh_token || !settings?.id) {
                return res.status(400).json({ error: 'Falta refresh_token ou ID da empresa' });
            }

            // Evitar múltiplas renovações simultâneas que invalidam o token na Shopee
            const globalAny = global as any;
            if (globalAny.__shopeeRefreshPromise) {
                console.log('⏳ Aguardando renovação de token em andamento...');
                try {
                    const data = await globalAny.__shopeeRefreshPromise;
                    if (data?.access_token) {
                        return res.status(200).json({ success: true, access_token: data.access_token });
                    }
                    return res.status(400).json({ error: 'Falha na renovação simultânea' });
                } catch (e) {
                    return res.status(400).json({ error: 'Falha na renovação' });
                }
            }

            globalAny.__shopeeRefreshPromise = (async () => {
                const apiPath = '/api/v2/auth/access_token/get';
                const timestamp = Math.floor(Date.now() / 1000);
                
                const baseStr = partnerId + apiPath + timestamp;
                const sign = crypto.createHmac('sha256', partnerKey).update(baseStr).digest('hex');
                
                const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
                const r = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shop_id: Number(shopId), refresh_token: settings.shopee_refresh_token, partner_id: Number(partnerId) })
                });
                return await r.json();
            })();

            try {
                const data = await globalAny.__shopeeRefreshPromise;
                
                if (data.access_token) {
                    await supabase.from('company_settings').update({
                        shopee_access_token: data.access_token,
                        shopee_refresh_token: data.refresh_token
                    }).eq('id', settings.id);
                    return res.status(200).json({ success: true, access_token: data.access_token });
                } else {
                    return res.status(400).json({ error: 'Falha ao renovar token', details: data });
                }
            } finally {
                globalAny.__shopeeRefreshPromise = null;
            }
        }

        if (action === 'get_shop_info') {
            const apiPath = '/api/v2/shop/get_shop_info';
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
            const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;
            const r = await fetch(url);
            const data = await r.json();
            return res.status(200).json(data);
        }

        if (action === 'get_order_list') {
            let { time_range_field, time_from, time_to, page_size, cursor, order_status } = payload;
            
            if (!time_from) {
                time_to = Math.floor(Date.now() / 1000);
                time_from = time_to - (15 * 24 * 60 * 60);
            }

            const apiPath = '/api/v2/order/get_order_list';
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);

            let url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&time_range_field=${time_range_field || 'create_time'}&time_from=${time_from}&time_to=${time_to}&page_size=${page_size || 50}`;
            if (cursor) url += `&cursor=${cursor}`;
            if (order_status) url += `&order_status=${order_status}`;

            const r = await fetch(url);
            const data = await r.json();
            return res.status(200).json(data);
        }

        if (action === 'get_escrow_list') {
            const { time_from, time_to, page_size = 50, page_no = 0 } = payload;
            if (!time_from || !time_to) return res.status(400).json({ error: 'time_from e time_to são obrigatórios' });

            const timestamp = Math.floor(Date.now() / 1000);
            const apiPath = '/api/v2/payment/get_escrow_list';
            const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
            
            const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&release_time_from=${time_from}&release_time_to=${time_to}&page_size=${page_size}&page_no=${page_no}`;

            const r = await fetch(url);
            const data = await r.json();
            return res.status(200).json(data);
        }

        if (action === 'get_order_detail') {
            const { order_sn_list } = payload;
            if (!order_sn_list) return res.status(400).json({ error: 'order_sn_list não fornecido' });

            const apiPath = '/api/v2/order/get_order_detail';
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);

            const snParam = Array.isArray(order_sn_list) ? order_sn_list.join(',') : order_sn_list;
            const optionalFields = 'buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,item_list,pay_time,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,buyer_cpf_id,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,total_amount,invoice_data,checkout_shipping_carrier,reverse_shipping_fee,order_chargeable_weight_gram,edt,prescription_images,prescription_check_status';
            
            const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&order_sn_list=${snParam}&response_optional_fields=${optionalFields}`;

            const r = await fetch(url);
            const data = await r.json();
            return res.status(200).json(data);
        }

        if (action === 'get_tracking_info') {
            const { order_sn } = payload;
            if (!order_sn) return res.status(400).json({ error: 'order_sn não fornecido' });

            const timestamp = Math.floor(Date.now() / 1000);
            
            // Endpoint 1: History Events
            const apiPath = '/api/v2/logistics/get_tracking_info';
            const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
            const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&order_sn=${order_sn}`;

            // Endpoint 2: Actual Tracking Number
            const infoPath = '/api/v2/logistics/get_tracking_number';
            const infoSign = generateSign(partnerId, partnerKey, infoPath, timestamp, accessToken, shopId);
            const infoUrl = `${shopeeApiUrl}${infoPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${infoSign}&order_sn=${order_sn}`;

            const [r1, r2] = await Promise.all([
                fetch(url),
                fetch(infoUrl)
            ]);

            const data = await r1.json();
            const dataNumber = await r2.json();

            // Mesclar o tracking_number real no objeto de resposta para o frontend
            if (data.response && dataNumber.response) {
                data.response.tracking_number_explicit = dataNumber.response.tracking_number || dataNumber.response.first_mile_tracking_number || dataNumber.response.logistics_tracking_no || "";
            }

            return res.status(200).json(data);
        }

        if (action === 'get_escrow_detail') {
            const { order_sn } = payload;
            if (!order_sn) return res.status(400).json({ error: 'order_sn não fornecido' });

            const apiPath = '/api/v2/payment/get_escrow_detail';
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
            
            const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&order_sn=${order_sn}`;

            const r = await fetch(url);
            const data = await r.json();
            return res.status(200).json(data);
        }

        if (action === 'get_shipping_document') {
            const { order_sn, shipping_document_type } = payload;
            if (!order_sn) return res.status(400).json({ error: 'order_sn não fornecido' });

            // Step 1: Get document info to grab the URL
            const infoPath = '/api/v2/logistics/get_shipping_document_info';
            const ts1 = Math.floor(Date.now() / 1000);
            const infoSign = generateSign(partnerId, partnerKey, infoPath, ts1, accessToken, shopId);
            const infoUrl = `${shopeeApiUrl}${infoPath}?partner_id=${partnerId}&timestamp=${ts1}&access_token=${accessToken}&shop_id=${shopId}&sign=${infoSign}`;

            const infoRes = await fetch(infoUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_list: [{ order_sn, shipping_document_type: shipping_document_type || 'SHIPPING_LABEL' }] })
            });
            const infoData = await infoRes.json();
            
            // Step 2: Download the document
            const docPath = '/api/v2/logistics/download_shipping_document';
            const ts2 = Math.floor(Date.now() / 1000);
            const docSign = generateSign(partnerId, partnerKey, docPath, ts2, accessToken, shopId);
            const docApiUrl = `${shopeeApiUrl}${docPath}?partner_id=${partnerId}&timestamp=${ts2}&access_token=${accessToken}&shop_id=${shopId}&sign=${docSign}`;
            
            const docRes = await fetch(docApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_list: [{ order_sn, shipping_document_type: shipping_document_type || 'SHIPPING_LABEL' }] })
            });

            // If response is PDF binary, pass it along
            const contentType = docRes.headers.get('content-type') || '';
            if (contentType.includes('application/pdf')) {
                const pdfBuffer = await docRes.arrayBuffer();
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="etiqueta-${order_sn}.pdf"`);
                return res.status(200).send(Buffer.from(pdfBuffer));
            }
            
            // Otherwise return JSON (might contain URL or error)
            const docData = await docRes.json();
            return res.status(200).json({ info: infoData, doc: docData });
        }

        if (action === 'ship_order') {
            const { order_sn } = payload;
            if (!order_sn) return res.status(400).json({ error: 'order_sn não fornecido' });

            const orderSn = String(order_sn).trim();
            const requestedPackageNumber = String(package_number || '').trim();
            const orderDetail = await shopeeGetSigned(
                '/api/v2/order/get_order_detail',
                `&order_sn_list=${encodeURIComponent(orderSn)}&response_optional_fields=package_list,shipping_carrier,order_status,fulfillment_flag`
            );

            if (orderDetail?.error) {
                return res.status(200).json({
                    error: 'ship_order_precheck_failed',
                    message: orderDetail.message || orderDetail.error,
                    details: orderDetail,
                });
            }

            const order = orderDetail?.response?.order_list?.[0];
            if (!order) {
                return res.status(200).json({
                    error: 'ship_order_precheck_failed',
                    message: 'Pedido nÃ£o encontrado na Shopee antes de preparar envio.',
                    details: orderDetail,
                });
            }

            if (order.order_status !== 'READY_TO_SHIP') {
                return res.status(200).json({
                    error: 'ship_order_not_ready',
                    message: `Pedido ${orderSn} estÃ¡ com status ${order.order_status || 'desconhecido'}; ship_order sÃ³ serÃ¡ chamado para READY_TO_SHIP.`,
                    details: { order_status: order.order_status },
                });
            }

            const packageList = Array.isArray(order.package_list) ? order.package_list : [];
            const selectedPackage = requestedPackageNumber
                ? packageList.find((pkg: any) => String(pkg?.package_number || '').trim() === requestedPackageNumber)
                : packageList[0];
            const resolvedPackageNumber = firstNonEmpty(selectedPackage?.package_number, requestedPackageNumber);

            if (!resolvedPackageNumber) {
                return res.status(200).json({
                    error: 'ship_order_package_not_found',
                    message: 'NÃ£o foi possÃ­vel identificar o pacote do pedido para validar o preparo de envio.',
                    details: { order_sn: orderSn, package_list: packageList },
                });
            }

            const packageDetail = await shopeeGetSigned(
                '/api/v2/order/get_package_detail',
                `&order_sn=${encodeURIComponent(orderSn)}&package_number=${encodeURIComponent(resolvedPackageNumber)}`
            );
            const detailPackage =
                packageDetail?.response?.package_detail ||
                packageDetail?.response?.package_list?.[0] ||
                packageDetail?.response ||
                {};
            const fulfillmentStatus = firstNonEmpty(
                detailPackage.fulfillment_status,
                detailPackage.logistics_status,
                selectedPackage?.fulfillment_status,
                selectedPackage?.logistics_status,
            );
            const isShipmentArrangedRaw =
                detailPackage.is_shipment_arranged ??
                selectedPackage?.is_shipment_arranged;
            const isShipmentArranged = isShipmentArrangedRaw === true || String(isShipmentArrangedRaw).toLowerCase() === 'true';

            if (packageDetail?.error || !fulfillmentStatus) {
                return res.status(200).json({
                    error: 'ship_order_precheck_failed',
                    message: 'NÃ£o foi possÃ­vel confirmar que o pacote estÃ¡ pronto para envio. A chamada ship_order foi bloqueada para preservar a taxa de sucesso da Shopee.',
                    details: { package_detail: packageDetail, package_number: resolvedPackageNumber },
                });
            }

            if (isShipmentArranged || fulfillmentStatus === 'LOGISTICS_REQUEST_CREATED') {
                return res.status(200).json({
                    success: true,
                    already_arranged: true,
                    message: 'O envio deste pacote jÃ¡ foi preparado anteriormente.',
                    details: { package_number: resolvedPackageNumber, fulfillment_status: fulfillmentStatus, is_shipment_arranged: isShipmentArranged },
                });
            }

            if (fulfillmentStatus !== 'LOGISTICS_READY') {
                return res.status(200).json({
                    error: 'ship_order_package_not_ready',
                    message: `Pacote ${resolvedPackageNumber} ainda nÃ£o estÃ¡ pronto para ship_order. Status atual: ${fulfillmentStatus}.`,
                    details: { package_number: resolvedPackageNumber, fulfillment_status: fulfillmentStatus, is_shipment_arranged: isShipmentArranged },
                });
            }

            // First we need to get shipping parameter to fulfill logistics properly
            // But a simple ship_order for drop-off usually requires dropoff object.
            // Let's implement standard ship_order
            const shipPayload = {
                order_sn: orderSn,
                package_number: resolvedPackageNumber,
                dropoff: {} // Try simple dropoff
            };

            const data = await shopeePostSigned('/api/v2/logistics/ship_order', shipPayload);
            return res.status(200).json(data);
        }

        // O FLUXO DE SINCRONIZAÇÃO DE PRODUTO
        if (action === 'add_item') {
            const { product_id } = req.body;
            if (!product_id) return res.status(400).json({ error: 'product_id não fornecido' });

            // 1. Buscar do VPS
            const vpsReq = await fetch(`https://api.xiaomipetrolina.com.br/products/${product_id}`);
            if (!vpsReq.ok) return res.status(404).json({ error: 'Produto não encontrado na VPS' });
            const product = await vpsReq.json();

            // Não tentar criar novamente na Shopee quando já há vínculo.
            if (product?.shopee_item_id) {
                return res.status(409).json({
                    error: 'Produto já vinculado à Shopee',
                    item_id: Number(product.shopee_item_id),
                });
            }

            // Fallback: alguns fluxos antigos gravam vínculo em shopee_products.
            const { data: linked } = await supabase
                .from('shopee_products')
                .select('shopee_item_id')
                .eq('product_id', product_id)
                .not('shopee_item_id', 'is', null)
                .limit(1)
                .maybeSingle();

            if (linked?.shopee_item_id) {
                return res.status(409).json({
                    error: 'Produto já vinculado à Shopee',
                    item_id: Number(linked.shopee_item_id),
                });
            }

            // 2. Upload das imagens para a Shopee
            const imageIdList: string[] = [];
            for (let imgUrl of product.images || []) {
                try {
                    let buffer: Buffer;
                    let filename = 'image.jpg';
                    let mimeType = 'image/jpeg';

                    if (imgUrl.startsWith('data:image')) {
                        const matches = imgUrl.match(/^data:(image\/\w+);base64,(.*)$/);
                        if (!matches) continue;
                        mimeType = matches[1];
                        filename = `img_${Date.now()}.${mimeType.split('/')[1]}`;
                        buffer = Buffer.from(matches[2], 'base64');
                    } else {
                        const imgRes = await fetch(imgUrl);
                        if (!imgRes.ok) continue;
                        const arrayBuffer = await imgRes.arrayBuffer();
                        buffer = Buffer.from(arrayBuffer);
                        filename = imgUrl.split('/').pop() || 'image.jpg';
                        mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
                    }

                    // Prepara o form-data simulado manualmente ou via pacote
                    // Em Vercel Serverless Form-data nativo do fetch é a melhor opção se NodeJS >= 18
                    const formData = new FormData();
                    formData.append('image', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

                    const uploadPath = '/api/v2/media_space/upload_image';
                    const ts = Math.floor(Date.now() / 1000);
                    const signImg = generateSign(partnerId, partnerKey, uploadPath, ts, accessToken, shopId);
                    
                    const uploadUrl = `${shopeeApiUrl}${uploadPath}?partner_id=${partnerId}&timestamp=${ts}&access_token=${accessToken}&shop_id=${shopId}&sign=${signImg}`;
                    
                    const uploadRes = await fetch(uploadUrl, {
                        method: 'POST',
                        body: formData as any
                    });
                    
                    const uploadData = await uploadRes.json();
                    if (!uploadData.error && uploadData.response?.image_info?.image_id) {
                        imageIdList.push(uploadData.response.image_info.image_id);
                    }
                } catch (e) {
                    console.error("Erro upload imagem:", e);
                }
            }

            // 3. Montar Payload add_item
            const description = product.description 
                ? product.description.replace(/<[^>]*>?/gm, '') // Remove HTML
                : product.name;

            const shopeePayload = {
                original_price: product.price_retail / 100, // Preço em Reais
                description: description.substring(0, 3000), // Max leng
                item_name: product.name.substring(0, 120), // Max leng
                normal_stock: product.track_inventory ? product.stock_quantity : 999,
                weight: product.weight_kg ? (product.weight_kg > 0.05 ? product.weight_kg : 0.1) : 0.5,
                item_status: "NORMAL",
                category_id: 100013, // Categoria Padrão Placeholder (E.g. Celulares). Fase 3 mapear dinâmico.
                image: {
                    image_id_list: imageIdList.length > 0 ? imageIdList : undefined
                },
                brand: {
                    brand_id: 0,
                    original_brand_name: "NoBrand" // Brand precisa ser ID mapeado, NoBrand = 0
                },
                logistics: [
                    {
                        logistic_id: 30018, // Correios ou transportadora padrão da Shopee
                        enabled: true,
                    }
                ]
            };

            const addPath = '/api/v2/product/add_item';
            const addTs = Math.floor(Date.now() / 1000);
            const addSign = generateSign(partnerId, partnerKey, addPath, addTs, accessToken, shopId);
            const addUrl = `${shopeeApiUrl}${addPath}?partner_id=${partnerId}&timestamp=${addTs}&access_token=${accessToken}&shop_id=${shopId}&sign=${addSign}`;

            const addRes = await fetch(addUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shopeePayload)
            });

            const addData = await addRes.json();
            
            if (addData.error) {
                return res.status(400).json({ error: addData.error, message: addData.message, details: addData });
            }

            const shopeeItemId = addData.response.item_id;

            // 4. Salvar na VPS
            // Não deletamos payload e mandamos o upsert via PUT
            const syncKey = process.env.VPS_SYNC_KEY || '';
            const updateVpsReq = await fetch(`https://api.xiaomipetrolina.com.br/products/${product_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
                body: JSON.stringify({ ...product, shopee_item_id: shopeeItemId })
            });

            return res.status(200).json({ item_id: shopeeItemId, data: addData.response });
        }

        if (action === 'update_stock') {
            const { product_id, stock } = req.body;
            if (!product_id || stock === undefined) return res.status(400).json({ error: 'Faltam parametros' });

            const vpsReq = await fetch(`https://api.xiaomipetrolina.com.br/products/${product_id}`);
            if (!vpsReq.ok) return res.status(404).json({ error: 'Produto não encontrado na VPS' });
            const product = await vpsReq.json();

            if (!product.shopee_item_id) return res.status(400).json({ error: 'Produto não vinculado a Shopee' });

            const shopeePayload = {
                item_id: product.shopee_item_id,
                stock_list: [
                    {
                        model_id: 0,
                        normal_stock: stock
                    }
                ]
            };

            const path = '/api/v2/product/update_stock';
            const ts = Math.floor(Date.now() / 1000);
            const sign = generateSign(partnerId, partnerKey, path, ts, accessToken, shopId);
            const url = `${shopeeApiUrl}${path}?partner_id=${partnerId}&timestamp=${ts}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

            const updateRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shopeePayload)
            });

            const data = await updateRes.json();
            if (data.error) return res.status(400).json(data);
            return res.status(200).json(data);
        }

        if (action === 'update_price') {
            const { product_id, price } = req.body;
            if (!product_id || price === undefined) return res.status(400).json({ error: 'Faltam parametros' });

            const vpsReq = await fetch(`https://api.xiaomipetrolina.com.br/products/${product_id}`);
            if (!vpsReq.ok) return res.status(404).json({ error: 'Produto não encontrado na VPS' });
            const product = await vpsReq.json();

            if (!product.shopee_item_id) return res.status(400).json({ error: 'Produto não vinculado a Shopee' });

            const shopeePayload = {
                item_id: product.shopee_item_id,
                price_list: [
                    {
                        model_id: 0,
                        original_price: price / 100 // Preço em centavos para reais
                    }
                ]
            };

            const path = '/api/v2/product/update_price';
            const ts = Math.floor(Date.now() / 1000);
            const sign = generateSign(partnerId, partnerKey, path, ts, accessToken, shopId);
            const url = `${shopeeApiUrl}${path}?partner_id=${partnerId}&timestamp=${ts}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

            const updateRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shopeePayload)
            });

            const data = await updateRes.json();
            if (data.error) return res.status(400).json(data);
            return res.status(200).json(data);
        }
        
        return res.status(400).json({ error: 'Ação desconhecida' });

    } catch (error: any) {
        console.error("Shopee Actions Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
