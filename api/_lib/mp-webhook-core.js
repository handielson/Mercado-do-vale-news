import { createClient } from '@supabase/supabase-js';

/**
 * Núcleo do webhook do Mercado Pago. Mantido em `_lib/` (prefixo `_` faz a
 * Vercel ignorar como serverless function), o handler real é roteado pelo
 * `api/bling-webhook.ts` quando o payload é detectado como MP, e a URL
 * pública `/api/mercadopago-webhook` chega aqui via rewrite no vercel.json.
 *
 * Anti-spoof: o payload do MP só carrega o ID do pagamento. A gente sempre
 * busca o pagamento real via GET /v1/payments/{id} usando o access_token
 * salvo na integração — nada do payload bruto vai pro banco direto.
 */

export function isMercadoPagoWebhook(body) {
    if (!body || typeof body !== 'object') return false;
    const type = String(body.type || '').toLowerCase();
    const action = String(body.action || '').toLowerCase();
    return (type === 'payment' || action.startsWith('payment.')) && !!body?.data?.id;
}

export async function handleMercadoPagoWebhook(body) {
    const paymentId = body?.data?.id;
    if (!paymentId) {
        return { status: 200, body: { message: 'ignored', reason: 'no payment id' } };
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
        || process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.VITE_SUPABASE_ANON_KEY
        || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('[MP Webhook] Supabase env vars missing');
        return { status: 200, body: { error: 'supabase not configured' } };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: integ, error: integErr } = await supabase
        .from('payment_integrations')
        .select('access_token, is_active')
        .eq('gateway_name', 'mercado_pago')
        .eq('is_active', true)
        .single();

    if (integErr || !integ?.access_token) {
        console.error('[MP Webhook] Integração mercado_pago não encontrada/ativa:', integErr);
        return { status: 200, body: { error: 'integration not configured' } };
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${integ.access_token}` }
    });

    if (!mpRes.ok) {
        const errBody = await mpRes.text().catch(() => '');
        console.error(`[MP Webhook] Falha ao consultar pagamento ${paymentId}:`, mpRes.status, errBody);
        return { status: 200, body: { error: 'payment lookup failed' } };
    }

    const payment = await mpRes.json();
    console.log(`[MP Webhook] payment ${payment.id} status=${payment.status}`);

    if (payment.status !== 'approved') {
        return { status: 200, body: { message: 'ignored', reason: `status=${payment.status}` } };
    }

    const gatewayPaymentId = String(payment.id);

    const { data: order, error: fetchErr } = await supabase
        .from('orders')
        .select('id, status')
        .eq('gateway_payment_id', gatewayPaymentId)
        .single();

    if (fetchErr || !order) {
        console.error(`[MP Webhook] Pedido não encontrado para gateway_payment_id=${gatewayPaymentId}:`, fetchErr);
        return { status: 200, body: { error: 'order not found' } };
    }

    const finalStatuses = ['paid', 'preparing', 'shipped', 'delivered', 'completed'];
    if (finalStatuses.includes(order.status)) {
        return { status: 200, body: { message: 'already processed', order_id: order.id } };
    }

    const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'paid', payment_status: 'paid' })
        .eq('id', order.id);

    if (updateErr) {
        console.error(`[MP Webhook] Falha ao atualizar pedido ${order.id}:`, updateErr);
        return { status: 200, body: { error: 'update failed' } };
    }

    console.log(`[MP Webhook] Pedido ${order.id} marcado como pago.`);
    return { status: 200, body: { message: 'success', order_id: order.id } };
}
