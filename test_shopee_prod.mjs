import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

function generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId) {
    const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: s } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();
        
    const partnerId = s.shopee_partner_id;
    const partnerKey = s.shopee_partner_key;
    const shopId = s.shopee_shop_id;
    const accessToken = s.shopee_access_token;
    
    console.log('Settings Data:');
    console.log('Partner ID:', partnerId, typeof partnerId);
    console.log('Key length:', partnerKey?.length);
    console.log('Shop ID:', shopId, typeof shopId);
    console.log('Token length:', accessToken?.length);

    if (!accessToken) {
        console.log("No token in Supabase!");
        return;
    }

    const apiPath = '/api/v2/shop/get_shop_info';
    const timestamp = Math.floor(Date.now() / 1000);
    
    const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
    
    // Teste Prod
    const url = `https://partner.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;
    console.log('\nURL (Prod):', url);
    const r1 = await fetch(url);
    const j1 = await r1.json();
    console.log('Prod Response:', j1);
    
    // Teste Sandbox (mesmo q ID seja de prod, só pra ver o erro exato)
    const urlSandbox = `https://partner.test-stable.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;
    console.log('\nURL (Sandbox):', urlSandbox);
    const r2 = await fetch(urlSandbox);
    console.log('Sandbox Response:', await r2.json());
}

run().catch(console.error);
