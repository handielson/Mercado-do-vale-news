const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const crypto = require('crypto');

const DB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL; 
const DB_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(DB_URL, DB_KEY);

async function testToken() {
    console.log("Conectando ao Supabase...");
    const { data: supaData, error } = await supabase
        .from('company_settings')
        .select('shopee_partner_id, shopee_partner_key, shopee_shop_id, shopee_access_token, shopee_refresh_token')
        .limit(1)
        .single();

    if (error) { console.error("Erro Supabase:", error); return; }

    console.log("Tokens carregados:");
    console.log("- Access Token:", supaData.shopee_access_token?.substring(0, 10) + "...");
    console.log("- Refresh Token:", supaData.shopee_refresh_token?.substring(0, 10) + "...");

    const partnerId = supaData.shopee_partner_id;
    const partnerKey = supaData.shopee_partner_key;
    const shopId = supaData.shopee_shop_id;

    const shopeeApiUrl = String(partnerId).startsWith('10') ? 'https://partner.test-stable.shopeemobile.com' : 'https://partner.shopeemobile.com';

    // TEST REFRESH TOKEN OVER API
    const apiPath = '/api/v2/auth/access_token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const baseStr = partnerId + apiPath + timestamp;
    const sign = crypto.createHmac('sha256', partnerKey).update(baseStr).digest('hex');
    
    const url = `${shopeeApiUrl}${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
    
    console.log("Tentando realizar REFRESH MANUAL agora...");
    const rfRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: Number(shopId), refresh_token: supaData.shopee_refresh_token, partner_id: Number(partnerId) })
    });

    const rfData = await rfRes.json();
    console.log("Shopee Refresh Response:", rfData);
}

testToken();
