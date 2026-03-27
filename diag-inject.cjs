const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const DB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL; 
const DB_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(DB_URL, DB_KEY);

async function inject() {
    const { data: supaData } = await supabase.from('company_settings').select('*').limit(1).single();
    
    const partnerId = supaData.shopee_partner_id;
    const partnerKey = supaData.shopee_partner_key;
    const shopId = supaData.shopee_shop_id;
    
    const shopeeApiUrl = String(partnerId).startsWith('10') ? 'https://partner.test-stable.shopeemobile.com' : 'https://partner.shopeemobile.com';

    // MANUAL REFRESH
    const apiPath = '/api/v2/auth/access_token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseStr = partnerId + apiPath + timestamp;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseStr).digest('hex');
    const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
    
    // Check if the current token is totally corrupted
    // If it's corrupted, we will print it. If it is, the refresh token might be lost.
    console.log("OLD REFRESH:", supaData.shopee_refresh_token);
    
    const rfRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: Number(shopId), refresh_token: supaData.shopee_refresh_token, partner_id: Number(partnerId) })
    });
    
    const rfData = await rfRes.json();
    console.log("NOVO:", rfData);
    
    if (rfData.access_token) {
        // Agora salvamos manualmente
        const res = await supabase.from('company_settings').update({
            shopee_access_token: rfData.access_token,
            shopee_refresh_token: rfData.refresh_token
        }).eq('id', supaData.id);
        
        console.log("Atualizando UUID:", supaData.id, res.error ? "ERRO:"+res.error.message : "SUCESSO");
    } else {
        console.log("Nao foi possivel usar refresh token.");
    }
}

inject();
