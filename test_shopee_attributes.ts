import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

const SHOPEE_LIVE_URL = 'https://partner.shopeemobile.com';

function generateSign(partnerId: string, partnerKey: string, apiPath: string, timestamp: number, accessToken: string, shopId: string) {
    const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

async function getCredentials() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase.from('company_settings').select('shopee_partner_id, shopee_partner_key, shopee_access_token, shopee_shop_id').single();
    return {
        partnerId: data.shopee_partner_id,
        partnerKey: data.shopee_partner_key,
        accessToken: data.shopee_access_token,
        shopId: data.shopee_shop_id,
    };
}

async function testApi(apiPath: string, extraParams: string) {
    const creds = await getCredentials();
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(creds.partnerId, creds.partnerKey, apiPath, timestamp, creds.accessToken, creds.shopId);
    const base = `${SHOPEE_LIVE_URL}${apiPath}?partner_id=${creds.partnerId}&timestamp=${timestamp}&access_token=${creds.accessToken}&shop_id=${creds.shopId}&sign=${sign}`;
    const url = `${base}${extraParams}`;
    console.log("Testing:", url);
    const r = await fetch(url);
    const data = await r.json();
    console.log("Response:", JSON.stringify(data).substring(0, 1000));
}

// Test tree
testApi('/api/v2/product/get_attribute_tree', '&category_id_list=101100&language=pt-BR');
