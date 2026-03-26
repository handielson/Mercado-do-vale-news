/**
 * Atualiza as credenciais de producao da Shopee na VPS
 * (sobrescrevendo os dados de Sandbox antigos)
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VPS_URL = 'https://api.xiaomipetrolina.com.br';
const VPS_SYNC_KEY = process.env.VITE_VPS_SYNC_KEY;

async function run() {
    // 1. Buscar dados corretos do Supabase
    const { data: s } = await supabase.from('company_settings').select('*').limit(1).single();
    console.log('Dados do Supabase:');
    console.log('  Partner ID:', s.shopee_partner_id);
    console.log('  Shop ID:', s.shopee_shop_id);
    console.log('  Token length:', s.shopee_access_token?.length);
    
    // 2. Verificar o que a VPS tem agora
    console.log('\nVerificando VPS atual...');
    const vpsR = await fetch(`${VPS_URL}/company-settings`);
    const vpsData = await vpsR.json();
    console.log('VPS - Partner ID atual:', vpsData.shopee_partner_id);
    console.log('VPS - Shop ID atual:', vpsData.shopee_shop_id);
    console.log('VPS - Token length:', vpsData.shopee_access_token?.length);
    
    // 3. Atualizar VPS com os dados corretos do Supabase
    console.log('\nAtualizando VPS com credenciais de producao...');
    const updatePayload = {
        ...vpsData,
        shopee_partner_id: s.shopee_partner_id,
        shopee_partner_key: s.shopee_partner_key,
        shopee_shop_id: s.shopee_shop_id,
        shopee_access_token: s.shopee_access_token,
        shopee_refresh_token: s.shopee_refresh_token,
    };
    
    const updateR = await fetch(`${VPS_URL}/company-settings`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'X-Sync-Key': VPS_SYNC_KEY || ''
        },
        body: JSON.stringify(updatePayload)
    });
    
    if (updateR.ok) {
        const updated = await updateR.json();
        console.log('VPS atualizada com sucesso!');
        console.log('  Novo Partner ID:', updated.shopee_partner_id);
        console.log('  Novo Shop ID:', updated.shopee_shop_id);
    } else {
        const err = await updateR.text();
        console.log('Erro ao atualizar VPS:', updateR.status, err);
    }
}

run().catch(console.error);
