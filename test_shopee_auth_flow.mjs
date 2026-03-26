/**
 * Testa o fluxo COMPLETO de auth da Shopee:
 * 1. Genera a URL de autorização (como o /api/shopee?action=auth faz)
 * 2. Testa a assinatura do token/get com um código fake (para ver se o algoritmo está correto)
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

// === SIGN FUNCTION USADA NO auth.ts (SEM accessToken/shopId) ===
function generateSignAuth(partnerId, partnerKey, apiPath, timestamp) {
    const baseString = `${partnerId}${apiPath}${timestamp}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

// === SIGN FUNCTION USADA NO shop-actions.ts (COM accessToken/shopId) ===
function generateSignShop(partnerId, partnerKey, apiPath, timestamp, accessToken, shopId) {
    const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: s } = await supabase.from('company_settings').select('*').limit(1).single();
    
    const partnerId = Number(s.shopee_partner_id);
    const partnerKey = s.shopee_partner_key;
    const shopId = s.shopee_shop_id; // pode ser string ou number
    const accessToken = s.shopee_access_token;
    
    console.log('=== DADOS DO BANCO ===');
    console.log('partnerId:', partnerId, typeof partnerId);
    console.log('partnerKey length:', partnerKey?.length);
    console.log('shopId:', shopId, typeof shopId);
    console.log('accessToken length:', accessToken?.length);
    
    const LIVE_URL = 'https://partner.shopeemobile.com';
    
    // === TESTE 1: AUTH_PARTNER (como o botão "Autorizar" faz) ===
    console.log('\n=== TESTE 1: auth_partner (redireciona user para Shopee) ===');
    const authPath = '/api/v2/shop/auth_partner';
    const authTs = Math.floor(Date.now() / 1000);
    const authSign = generateSignAuth(partnerId.toString(), partnerKey, authPath, authTs);
    const redirectUrl = 'https://mercadodovale.com.br/api/shopee?action=callback';
    const authUrl = `${LIVE_URL}${authPath}?partner_id=${partnerId}&timestamp=${authTs}&sign=${authSign}&redirect=${encodeURIComponent(redirectUrl)}`;
    console.log('Auth URL gerada:', authUrl);
    console.log('(esta URL redireciona o usuário para a Shopee, não podemos testar o response)');
    
    // === TESTE 2: TOKEN/GET com código FAKE (para verificar se o algoritmo é correto) ===
    console.log('\n=== TESTE 2: token/get - assinatura CORRETA (auth: sem accessToken) ===');
    const tokenPath = '/api/v2/auth/token/get';
    const tokenTs = Math.floor(Date.now() / 1000);
    const tokenSign = generateSignAuth(partnerId.toString(), partnerKey, tokenPath, tokenTs);
    const tokenUrl = `${LIVE_URL}${tokenPath}?partner_id=${partnerId}&timestamp=${tokenTs}&sign=${tokenSign}`;
    console.log('URL token/get:', tokenUrl);
    const r1 = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'FAKE_CODE_TEST', shop_id: Number(shopId), partner_id: partnerId })
    });
    const j1 = await r1.json();
    console.log('Resposta (esperado error_auth, não error_sign):', j1);

    // === TESTE 3: TOKEN/GET com assinatura ERRADA para comparar ===
    console.log('\n=== TESTE 3: token/get - assinatura INCORRETA (com accessToken incluído) ===');
    const tokenTs2 = Math.floor(Date.now() / 1000);
    const tokenSignWrong = generateSignShop(partnerId.toString(), partnerKey, tokenPath, tokenTs2, accessToken, shopId);
    const tokenUrlWrong = `${LIVE_URL}${tokenPath}?partner_id=${partnerId}&timestamp=${tokenTs2}&sign=${tokenSignWrong}`;
    const r2 = await fetch(tokenUrlWrong, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'FAKE_CODE_TEST', shop_id: Number(shopId), partner_id: partnerId })
    });
    const j2 = await r2.json();
    console.log('Resposta (deve ser error_sign pois assinatura inclui accessToken indevidamente):', j2);
    
    // === TESTE 4: GET_SHOP_INFO (shop-level, USA accessToken) ===
    console.log('\n=== TESTE 4: get_shop_info com assinatura de shop ===');
    const shopPath = '/api/v2/shop/get_shop_info';
    const shopTs = Math.floor(Date.now() / 1000);
    const shopSign = generateSignShop(partnerId.toString(), partnerKey, shopPath, shopTs, accessToken, String(shopId));
    const shopUrl = `${LIVE_URL}${shopPath}?partner_id=${partnerId}&timestamp=${shopTs}&access_token=${accessToken}&shop_id=${shopId}&sign=${shopSign}`;
    const r3 = await fetch(shopUrl);
    const j3 = await r3.json();
    console.log('Resposta get_shop_info:', j3.shop_name ? `OK - ${j3.shop_name}` : j3);
}

run().catch(console.error);
