/**
 * Webhook do Bling — recebe notificações de movimentação de estoque
 * Configure em: Bling → Configurações → API → Webhooks → URL: /api/bling-webhook
 *
 * O Bling envia POST com JSON quando o estoque muda.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

export default async function handler(req: any, res: any) {
    // Bling pode enviar GET para validar a URL (deve retornar 200)
    if (req.method === 'GET') return res.status(200).json({ ok: true });
    if (req.method !== 'POST') return res.status(405).end();

    try {
        const payload = req.body;

        // Bling envia: { evento: "Estoque", data: { produto: { id }, saldoFisico } }
        // ou variações do formato dependendo da versão do webhook
        const evento = payload?.evento || payload?.event;
        const blingId = payload?.data?.produto?.id || payload?.dados?.produto?.id;
        const saldo = payload?.data?.saldoFisico ?? payload?.dados?.saldoFisico;

        // Só processa eventos de estoque com dados suficientes
        if (evento !== 'Estoque' || !blingId || saldo === undefined) {
            return res.status(200).json({ ok: true, ignored: true });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
            .from('products')
            .update({ stock_quantity: Math.max(0, saldo) })
            .eq('bling_id', blingId);

        if (error) {
            console.error('[bling-webhook] Erro ao atualizar estoque:', error.message);
            return res.status(200).json({ ok: false, error: error.message });
        }

        console.log(`[bling-webhook] Estoque atualizado: bling_id=${blingId} → ${saldo}`);
        return res.status(200).json({ ok: true });
    } catch (err: any) {
        console.error('[bling-webhook] Erro:', err.message);
        // Sempre retorna 200 para o Bling não reprocessar
        return res.status(200).json({ ok: false, error: err.message });
    }
}
