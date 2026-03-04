/**
 * Proxy serverless: deduz estoque de um produto no Bling
 * Chamado internamente após uma venda no PDV
 *
 * Body: { blingId: number, quantity: number, notes?: string }
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { blingId, quantity, notes } = req.body || {};
    if (!blingId || !quantity) return res.status(400).json({ error: 'blingId and quantity required' });

    try {
        // Busca token de acesso do Bling na tabela company_settings
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: settings } = await supabase
            .from('company_settings')
            .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
            .single();

        if (!settings?.bling_access_token) {
            return res.status(401).json({ error: 'Bling not connected' });
        }

        let accessToken = settings.bling_access_token;

        // Renovar token se expirado
        if (settings.bling_token_expires_at && new Date(settings.bling_token_expires_at) < new Date()) {
            const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: settings.bling_refresh_token,
                    client_id: settings.bling_client_id,
                    client_secret: settings.bling_client_secret,
                }),
            });
            if (tokenRes.ok) {
                const tokenData = await tokenRes.json();
                accessToken = tokenData.access_token;
                await supabase.from('company_settings').update({
                    bling_access_token: tokenData.access_token,
                    bling_refresh_token: tokenData.refresh_token,
                    bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
                }).eq('id', settings.id ?? 1);
            }
        }

        // Busca o depósito padrão do Bling
        const depRes = await fetch('https://www.bling.com.br/Api/v3/depositos?pagina=1&limite=1', {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
        });
        const depData = await depRes.json();
        const depositoId = depData.data?.[0]?.id;

        if (!depositoId) return res.status(422).json({ error: 'No Bling deposit found' });

        // Lança saída de estoque no Bling
        const stockRes = await fetch('https://www.bling.com.br/Api/v3/estoques', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                produto: { id: blingId },
                deposito: { id: depositoId },
                operacao: 'S',   // S = Saída
                quantidade: quantity,
                observacoes: notes || 'Venda PDV Mercado do Vale',
            }),
        });

        if (!stockRes.ok) {
            const err = await stockRes.text();
            return res.status(stockRes.status).json({ error: `Bling stock error: ${err}` });
        }

        return res.status(200).json({ ok: true });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
}
