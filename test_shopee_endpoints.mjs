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
    const { data: s } = await supabase.from('company_settings').select('*').limit(1).single();
    const partnerId = s.shopee_partner_id;
    const partnerKey = s.shopee_partner_key;
    const shopId = s.shopee_shop_id;
    const accessToken = s.shopee_access_token;
    
    const apiPath = '/api/v2/media_space/upload_image';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId);
    
    // Teste Prod (sem body, so pra ver se o erro é sign ou param)
    const url = `https://partner.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;
    console.log('\nURL (Image Upload):', url);
    const r1 = await fetch(url, { method: 'POST' });
    const j1 = await r1.json();
    console.log('Image Upload Response:', j1);
    
    const addPath = '/api/v2/product/add_item';
    const addTs = Math.floor(Date.now() / 1000);
    const addSign = generateSign(partnerId, partnerKey, addPath, addTs, accessToken, shopId);
    const urlAdd = `https://partner.shopeemobile.com${addPath}?partner_id=${partnerId}&timestamp=${addTs}&access_token=${accessToken}&shop_id=${shopId}&sign=${addSign}`;
    console.log('\nURL (Add Item):', urlAdd);
    const r2 = await fetch(urlAdd, { method: 'POST' });
    const j2 = await r2.json();
    console.log('Add Item Response:', j2);
}

run().catch(console.error);
