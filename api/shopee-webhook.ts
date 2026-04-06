import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../services/supabase'; // Ajuste conforme seu path
import crypto from 'crypto';

/**
 * Webhook Recebedor da Shopee Push Mechanism
 * Rota: POST /api/shopee-webhook
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const payload = req.body;
        
        // Push Mechanism Docs: code = 3 is "Order Status Update"
        // Payload sample: { "shop_id": 1234, "code": 3, "timestamp": 1234567, "data": { "ordersn": "xx", "status": "COMPLETED" } }
        
        if (payload && payload.code === 3 && payload.data) {
            const { ordersn, status } = payload.data;
            const shopId = payload.shop_id;
            
            console.log(`[Shopee Webhook] Order ${ordersn} update! Status: ${status}`);

            // Buscar configurações do painel admin para N8N
            const { data: settings } = await supabase
                .from('company_settings')
                .select('n8n_webhook_url')
                .limit(1)
                .single();

            // Notify N8N so it can trigger WhatsApp
            if (settings?.n8n_webhook_url) {
                // Ensure the URL is valid
                const webhookUrl = settings.n8n_webhook_url; 
                
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: 'shopee',
                        event: 'order_status_update',
                        order_sn: ordersn,
                        status: status,
                        shop_id: shopId
                    })
                }).catch(err => console.error("N8N relay error:", err));
            }
        }

        // Shopee expects a HTTP 200 JSON { "message": "success" } otherwise it retries
        return res.status(200).json({ message: "success" });

    } catch (e: any) {
        console.error("Shopee Webhook Error:", e);
        // Do not return 500 otherwise Shopee retries forever if there's a permanent logical error 
        // We'll return 200 with an error flag
        return res.status(200).json({ error: e.message });
    }
}
