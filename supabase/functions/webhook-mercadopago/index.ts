import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  // Apenas POST é aceito pelo Mercado Pago nas Webhooks
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("🔔 [Webhook Mercado Pago] Recebido:", JSON.stringify(payload));

    // MP envia { action: "payment.created" } ou { type: "payment", data: { id: "123" } }
    // Em Webhooks v1, o ID vem em data.id
    const paymentId = payload?.data?.id;
    const topic = payload?.type || payload?.topic;

    if (!paymentId || topic !== 'payment') {
      return new Response('Not a payment event, ignored.', { status: 200 });
    }

    // 1. Inicializa Cliente Admin (Ignora RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Procura pelo Pedido através do gateway_payment_id no BD
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, payment_status, company_id')
      .eq('gateway_payment_id', String(paymentId))
      .single();

    if (orderError || !order) {
      console.error(`❌ Pedido não encontrado para o pagamento ID: ${paymentId}`);
      // Retorna 200 pra o MP não ficar re-tentando infinitamente
      return new Response('Order ignored.', { status: 200 });
    }

    // Se já tá pago, ignora reprocessamento
    if (order.payment_status === 'paid') {
      return new Response('Order already paid.', { status: 200 });
    }

    // 3. Busca a Credencial do Cliente para bater na API Oficial do MP
    const { data: credentials } = await supabase
      .from('payment_integrations')
      .select('access_token')
      .eq('company_id', order.company_id)
      .eq('gateway_name', 'mercado_pago')
      .single();

    if (!credentials?.access_token) {
      throw new Error(`Sem Access Token para Company ID: ${order.company_id}`);
    }

    // 4. Pergunta ao MP: "Ei, esse pagamento aí tá aprovado de verdade?"
    const mpUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
    const mpRes = await fetch(mpUrl, {
      headers: { 'Authorization': `Bearer ${credentials.access_token}` }
    });

    if (!mpRes.ok) {
      throw new Error(`Falha verificando MP API: ${mpRes.statusText}`);
    }

    const mpVerification = await mpRes.json();

    // 5. Atualiza Status
    if (mpVerification.status === 'approved') {
      // PIX ou Cartão Aprovado -> Prepara separação do pedido
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'processing' // Pode ir pra cozinha, empacotar etc.
        })
        .eq('id', order.id);

      if (updateError) throw updateError;
      console.log(`✅ [Webhook MP] Pedido ${order.id} marcado como PAGO!`);
    } else if (mpVerification.status === 'rejected' || mpVerification.status === 'cancelled') {
      // Atualiza para falhado ou cancelado
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          status: 'cancelled'
        })
        .eq('id', order.id);

      if (updateError) throw updateError;
      console.log(`❌ [Webhook MP] Pedido ${order.id} REJEITADO/CANCELADO.`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("Erro no Webhook MP:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
