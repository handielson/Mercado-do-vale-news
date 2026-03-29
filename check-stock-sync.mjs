import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function getEnv(key) {
  const content = fs.readFileSync('.env.local', 'utf-8');
  const match = content.match(new RegExp(`${key}="([^"]+)"`));
  return match ? match[1] : process.env[key];
}

const url = getEnv('VITE_SUPABASE_URL');
const serviceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, serviceKey);

async function checkStockIssue() {
    console.log("🔍 Verificando os útimos webhooks de estoque recebidos do Bling...\n");
    
    // Obter últimos logs
    const { data: logs, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(10);
        
    if (error) {
        console.error("Erro ao ler webhook logs:", error.message);
        return;
    }

    const stockWebhooks = logs.filter(log => log.payload?.event?.includes('stock.'));
    console.log(`Encontrados ${stockWebhooks.length} webhooks de estoque recentes.`);

    for (const log of stockWebhooks) {
        const event = log.payload?.event;
        const blingId = log.payload?.data?.produto?.id;
        const stockFisico = log.payload?.data?.saldoFisicoTotal || log.payload?.data?.saldoVirtualTotal;
        const horaReceived = new Date(log.received_at).toLocaleTimeString('pt-BR');

        console.log(`\n📦 [${horaReceived}] Evento: ${event} | Bling ID: ${blingId} | Novo Estoque Bling: ${stockFisico}`);

        if (!blingId) {
            console.log("   ❌ Erro: O Bling não enviou o ID do produto no Payload.");
            continue;
        }

        // Buscar no banco se o bling_id existe mapeado
        const { data: foundProd, error: selErr } = await supabase
            .from('products')
            .select('id, name, sku, bling_id, stock_quantity')
            .eq('bling_id', blingId);

        if (selErr) {
            console.error("   ❌ Erro ao buscar produto no Supabase:", selErr.message);
            continue;
        }

        if (!foundProd || foundProd.length === 0) {
            console.log(`   🚨 ALERTA GERAL: O produto com bling_id [${blingId}] NÃO ESTÁ MAPEADO na tabela products!`);
            console.log(`   O Bling enviou a atualização de estoque corretamente para o Vercel. O Vercel recebeu o webhook, mas não encontrou no seu sistema nenhum produto (Pai ou Variação) salvo com este ID. Portanto, ele não teve onde descontar.`);
        } else {
            const p = foundProd[0];
            console.log(`   ✅ SUCESSO! Produto mapeado encontrado na Loja: [${p.sku}] - ${p.name}`);
            console.log(`   🔸 Estoque atual no Supabase: ${p.stock_quantity}`);
            if (p.stock_quantity === stockFisico) {
                console.log(`   🔹 CONCLUSÃO: O estoque FOI ATUALIZADO corretamente! Se no site ainda consta diferente, pode ser cache (F5) ou outro motivo não relacionado ao Banco.`);
            } else {
                console.log(`   🔹 CONCLUSÃO: O estoque DIFERE. O Webhook ocorreu ANTES ou DEPOIS do problema, ou ocorreu alguma falha na gravação do Vercel.`);
            }
        }
    }
}

checkStockIssue().catch(console.error);
