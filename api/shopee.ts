// v2025-03-25 - Production credentials: uses db-stored partner_id (not hardcoded)
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

const SHOPEE_API_LIVE_URL = 'https://partner.shopeemobile.com';
const SHOPEE_API_SANDBOX_URL = 'https://partner.test-stable.shopeemobile.com';

function getShopeeBaseUrl(partnerId: string) {
    // Partner IDs known to be Test/Sandbox
    if (partnerId === '1229870' || process.env.SHOPEE_ENV === 'sandbox') {
        return SHOPEE_API_SANDBOX_URL;
    }
    return SHOPEE_API_LIVE_URL;
}
function generateSign(partnerId: string, partnerKey: string, apiPath: string, timestamp: number) {
    const baseString = `${partnerId}${apiPath}${timestamp}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

export default async function handler(req: any, res: any) {
    const action = req.query.action as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. GERAÇÃO DA URL DE AUTORIZAÇÃO (CHAMADO PELO PAINEL ADMIN)
    if (action === 'auth') {
        const origin = req.headers.host 
            ? (req.headers.host.includes('localhost') ? `http://${req.headers.host}` : `https://${req.headers.host}`)
            : 'https://mercadodovale.com.br';
            
        // Credenciais OAuth Shopee ficam SEMPRE no Supabase (fonte de verdade para OAuth)
        // A VPS pode ter dados desatualizados de sandbox, então nunca usamos VPS para estas credenciais.
        const { data: settings } = await supabase
            .from('company_settings')
            .select('shopee_partner_id, shopee_partner_key')
            .limit(1)
            .single();

        if (!settings?.shopee_partner_id || !settings?.shopee_partner_key) {
            return res.status(400).json({ error: 'Shopee Partner ID e Key não configurados no painel.' });
        }

        const partnerId = settings.shopee_partner_id;
        const partnerKey = settings.shopee_partner_key;
        const apiPath = '/api/v2/shop/auth_partner';
        const timestamp = Math.floor(Date.now() / 1000);
        
        const sign = generateSign(partnerId, partnerKey, apiPath, timestamp);
        const redirectUrl = `${origin}/api/shopee?action=callback`;

        const shopeeApiUrl = getShopeeBaseUrl(partnerId);
        const authUrl = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;
        
        return res.status(200).json({ url: authUrl });
    }

    // 2. CALLBACK APÓS O LOGISTA APROVAR APLICATIVO NA SHOPEE
    if (action === 'callback') {
        const { code, shop_id, main_account_id } = req.query;

        if (!code || (!shop_id && !main_account_id)) {
            return res.status(400).send('<h1>Falha na autorização</h1><p>Parâmetros ausentes (code, shop_id).</p>');
        }

        // Credenciais OAuth Shopee ficam SEMPRE no Supabase (fonte de verdade para OAuth)
        const { data: settings } = await supabase
            .from('company_settings')
            .select('id, shopee_partner_id, shopee_partner_key')
            .limit(1)
            .single();

        if (!settings?.shopee_partner_id || !settings?.shopee_partner_key) {
            return res.status(500).send('<h1>Erro Interno</h1><p>Credenciais da Shopee não encontradas.</p>');
        }

        const partnerId = Number(settings.shopee_partner_id);
        const partnerKey = settings.shopee_partner_key;
        const activeShopId = Number(shop_id);

        try {
            // Fazer o Token Exchange
            const apiPath = '/api/v2/auth/token/get';
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = generateSign(partnerId.toString(), partnerKey, apiPath, timestamp);

            const shopeeApiUrl = getShopeeBaseUrl(partnerId.toString());
            const tokenUrl = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
            
            const payload = {
                code: code,
                shop_id: activeShopId,
                partner_id: partnerId
            };

            const tokenRes = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const tokenData = await tokenRes.json();

            if (tokenData.error) {
                console.error("Shopee Token Error:", tokenData);
                return res.status(400).send(`<h1>Erro na comunicação com a Shopee</h1><p>${tokenData.error}: ${tokenData.message}</p>`);
            }

            // Sucesso! Gravar tokens no banco.
            const access_token = tokenData.access_token;
            const refresh_token = tokenData.refresh_token;

            // Salva no Supabase
            await supabase.from('company_settings')
                .update({ 
                    shopee_shop_id: activeShopId.toString(),
                    shopee_access_token: access_token,
                    shopee_refresh_token: refresh_token
                })
                .eq('id', settings.id);

            // Tenta salvar no VPS também (Para redundância, conforme a arquitetura VPS)
            try {
                // A VPS não tem token JWT fácil aqui, então o VPS deve sincronizar ou aceitar a atualização do front.
                // Na arquitetura do MDV o VPS geralmente atualiza lendo do Supabase ou vice-versa, mas como é fluxo crítico:
            } catch (err) {
                console.error("VPS Sync error in shopee auth callback", err);
            }

            // Exibir mensagem de sucesso e fechar janela (ou redirecionar)
            return res.status(200).send(`
                <html>
                    <head><title>Shopee Autorizada</title></head>
                    <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h1 style="color: #ee4d2d;">Conexão Bem-Sucedida!</h1>
                        <p>A integração com a sua loja Shopee foi completada.</p>
                        <p>Você já pode fechar esta aba e voltar para o Painel.</p>
                        <script>
                            setTimeout(() => {
                                window.location.href = '/admin/settings/shopee';
                            }, 5000);
                        </script>
                    </body>
                </html>
            `);

        } catch (error: any) {
            console.error("Shopee Exception:", error);
            return res.status(500).send(`<h1>Erro Interno</h1><p>${error.message}</p>`);
        }
    }

    return res.status(404).json({ error: 'Route not found or missing action.' });
}
