import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function check() {
    console.log("Starting...");
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Fetching settings...");
    const { data: settings } = await supabase.from('company_settings').select('id, bling_refresh_token, bling_client_id, bling_client_secret').limit(1).single();
    
    // Refresh token
    const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${Buffer.from(settings.bling_client_id + ':' + settings.bling_client_secret).toString('base64')}` },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: settings.bling_refresh_token }),
    });
    const tokenData = await tokenRes.json();
    console.log("Token exchanged:", !!tokenData.access_token);
    
    if (tokenData.access_token) {
        // Save new tokens back to db just in case
        await supabase.from('company_settings').update({
            bling_access_token: tokenData.access_token,
            bling_refresh_token: tokenData.refresh_token
        }).eq('id', settings.id);
    }
    
    // Test API call to /estoques/saldos
    console.log("Fetching /estoques/saldos...");
    const res = await fetch(`https://www.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=5`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));

    console.log("Fetching /produtos...");
    const pRes = await fetch(`https://www.bling.com.br/Api/v3/produtos?pagina=1&limite=5`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const pJson = await pRes.json();
    console.log(JSON.stringify(pJson.data.map((p: any) => ({ id: p.id, nome: p.nome })), null, 2));
}

check().catch(console.error);
