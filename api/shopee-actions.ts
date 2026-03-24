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

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, payload } = req.body;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações da empresa
    const { data: settings } = await supabase
        .from('company_settings')
        .select('shopee_partner_id, shopee_partner_key, shopee_shop_id, shopee_access_token')
        .limit(1)
        .single();

    if (!settings?.shopee_access_token || !settings?.shopee_shop_id) {
        return res.status(401).json({ error: 'Shopee não conectada ou sem token' });
    }

    const partnerId = settings.shopee_partner_id;
    const partnerKey = settings.shopee_partner_key;
    const shopId = settings.shopee_shop_id;
    const accessToken = settings.shopee_access_token;

    try {
        if (action === 'get_shop_info') {
            const apiPath = '/api/v2/shop/get_shop_info';
            const timestamp = Math.floor(Date.now() / 1000);
            // Generate Signature
            const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
            const shopeeApiUrl = getShopeeBaseUrl(partnerId);

            // Fetch
            const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;
            
            const r = await fetch(url);
            const data = await r.json();
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
                    formData.append('image', new Blob([buffer], { type: mimeType }), filename);

                    const uploadPath = '/api/v2/media_space/upload_image';
                    const ts = Math.floor(Date.now() / 1000);
                    const signImg = generateSign(partnerId, partnerKey, uploadPath, ts, accessToken, shopId);
                    
                    const uploadUrl = `${SHOPEE_API_URL}${uploadPath}?partner_id=${partnerId}&timestamp=${ts}&access_token=${accessToken}&shop_id=${shopId}&sign=${signImg}`;
                    
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
            const addUrl = `${SHOPEE_API_URL}${addPath}?partner_id=${partnerId}&timestamp=${addTs}&access_token=${accessToken}&shop_id=${shopId}&sign=${addSign}`;

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
            const syncKey = process.env.VITE_VPS_SYNC_KEY || '';
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
            const url = `${SHOPEE_API_URL}${path}?partner_id=${partnerId}&timestamp=${ts}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

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
            const url = `${SHOPEE_API_URL}${path}?partner_id=${partnerId}&timestamp=${ts}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

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
