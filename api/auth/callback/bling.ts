import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function: troca o authorization_code do Bling pelo access_token
export default async function handler(req: any, res: any) {
    const { code, error, error_description } = req.query;

    if (error) {
        console.error('Bling OAuth error:', error, error_description);
        return res.redirect(302, `/admin/settings/bling?error=${encodeURIComponent(String(error))}`);
    }

    if (!code) {
        return res.redirect(302, '/admin/settings/bling?error=missing_code');
    }

    // Init Supabase com service role (server-side)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase env vars');
        return res.redirect(302, '/admin/settings/bling?error=server_config');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    // Buscar credenciais Bling salvas no banco
    const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('id, bling_client_id, bling_client_secret, bling_callback_url')
        .limit(1)
        .maybeSingle();

    if (settingsError || !settings?.bling_client_id || !settings?.bling_client_secret) {
        console.error('Bling credentials not found in DB:', settingsError);
        return res.redirect(302, '/admin/settings/bling?error=missing_credentials');
    }

    const callbackUrl = settings.bling_callback_url || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/callback/bling`;

    // Trocar code pelo access_token
    let tokenData: any;
    try {
        const credentials = Buffer.from(`${settings.bling_client_id}:${settings.bling_client_secret}`).toString('base64');

        const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: callbackUrl,
            }).toString(),
        });

        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            console.error('Bling token exchange failed:', tokenRes.status, errText);
            return res.redirect(302, `/admin/settings/bling?error=token_exchange_failed&status=${tokenRes.status}`);
        }

        tokenData = await tokenRes.json();
    } catch (fetchErr: any) {
        console.error('Fetch error during token exchange:', fetchErr);
        return res.redirect(302, '/admin/settings/bling?error=network_error');
    }

    // Calcular expiração (tokens Bling expiram em 1h por padrão)
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Salvar tokens no banco
    const { error: updateError } = await supabase
        .from('company_settings')
        .update({
            bling_access_token: tokenData.access_token,
            bling_refresh_token: tokenData.refresh_token || null,
            bling_token_expires_at: expiresAt,
        })
        .eq('id', settings.id);

    if (updateError) {
        console.error('Failed to save tokens:', updateError);
        return res.redirect(302, '/admin/settings/bling?error=save_failed');
    }

    // Sucesso — redireciona para a página Bling do admin
    return res.redirect(302, '/admin/settings/bling?connected=true');
}
