import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey =
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Webhook do Mercado Pago — recebe notificações de pagamento e marca o pedido
 * como "paid" quando o MP confirma a aprovação.
 *
 * Formato esperado (notificações v2):
 *   POST /api/mercadopago-webhook
 *   { "type": "payment", "data": { "id": "<payment_id>" } }
 *
 * Anti-spoof: nunca confiamos no payload bruto. Sempre buscamos o pagamento
 * via GET /v1/payments/{id} usando o access_token salvo no painel da loja
 * (paga com a integração mercado_pago).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = (req.body || {}) as { type?: string; action?: string; data?: { id?: string | number } };
        const type = body.type || body.action || '';
        const paymentId = body.data?.id;

        // MP envia vários tipos (payment, plan, subscription, etc). Só processamos pagamentos.
        if (!paymentId || !String(type).includes('payment')) {
            return res.status(200).json({ message: 'ignored', reason: 'not a payment event' });
        }

        // Busca o access_token do MP da integração ativa
        const { data: integ, error: integErr } = await supabase
            .from('payment_integrations')
            .select('access_token, is_active')
            .eq('gateway_name', 'mercado_pago')
            .eq('is_active', true)
            .single();

        if (integErr || !integ?.access_token) {
            console.error('[MP Webhook] Integração mercado_pago não encontrada/ativa:', integErr);
            return res.status(200).json({ error: 'integration not configured' });
        }

        // Anti-spoof: busca o pagamento direto na API do MP
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${integ.access_token}` }
        });

        if (!mpRes.ok) {
            const errBody = await mpRes.text().catch(() => '');
            console.error(`[MP Webhook] Falha ao consultar pagamento ${paymentId}:`, mpRes.status, errBody);
            return res.status(200).json({ error: 'payment lookup failed' });
        }

        const payment = await mpRes.json() as { id: number; status: string; status_detail?: string };
        console.log(`[MP Webhook] payment ${payment.id} status=${payment.status}`);

        if (payment.status !== 'approved') {
            return res.status(200).json({ message: 'ignored', reason: `status=${payment.status}` });
        }

        // Atualiza o pedido vinculado a esse gateway_payment_id
        const gatewayPaymentId = String(payment.id);

        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('id, status')
            .eq('gateway_payment_id', gatewayPaymentId)
            .single();

        if (fetchErr || !order) {
            console.error(`[MP Webhook] Pedido não encontrado para gateway_payment_id=${gatewayPaymentId}:`, fetchErr);
            return res.status(200).json({ error: 'order not found' });
        }

        // Idempotência: se já está pago, não faz nada
        if (order.status === 'paid' || order.status === 'preparing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed') {
            return res.status(200).json({ message: 'already processed', order_id: order.id });
        }

        const { error: updateErr } = await supabase
            .from('orders')
            .update({ status: 'paid', payment_status: 'paid' })
            .eq('id', order.id);

        if (updateErr) {
            console.error(`[MP Webhook] Falha ao atualizar pedido ${order.id}:`, updateErr);
            return res.status(200).json({ error: 'update failed' });
        }

        console.log(`[MP Webhook] Pedido ${order.id} marcado como pago.`);
        return res.status(200).json({ message: 'success', order_id: order.id });
    } catch (e: any) {
        console.error('[MP Webhook] erro inesperado:', e);
        // Sempre 200 pra MP não retentar infinito por erros internos nossos
        return res.status(200).json({ error: e.message });
    }
}
