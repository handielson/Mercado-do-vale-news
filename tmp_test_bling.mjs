import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    console.log('--- TESTE API BLING ESTOQUE ---');
    console.log('Buscando token no BD local...');
    const { data: settings } = await supabase.from('company_settings').select('bling_access_token').single();
    if (!settings || !settings.bling_access_token) {
        console.error('❌ Token do Bling não encontrado!');
        return;
    }
    const token = settings.bling_access_token;
    
    // Pega o último produto que tenha bling_id
    const { data: prods } = await supabase.from('products').select('name, bling_id, stock_quantity')
        .not('bling_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1);
        
    if (!prods || prods.length === 0) {
        console.error('❌ Não encontrou nenhum produto com bling_id no BD.');
        return;
    }
    
    const id = prods[0].bling_id;
    console.log(`✅ Testando com o produto: ${prods[0].name} (Bling ID: ${id})`);
    
    // Tenta diferentes formatos de URL para ver qual funciona (com e sem pagina, URL encoded)
    const urls = [
        `https://api.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${id}`,
        `https://api.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=100&idsProdutos[]=${id}`,
        `https://api.bling.com.br/Api/v3/estoques/saldos?idsProdutos%5B%5D=${id}`
    ];

    for (const url of urls) {
        console.log('\n========================================');
        console.log(`🔍 Testando URL: ${url}`);
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        console.log(`Status: ${res.status} ${res.statusText}`);
        if (res.ok) {
            const data = await res.json();
            console.log('Resposta DATA:');
            console.dir(data.data, { depth: null });
        } else {
            console.log('Erro:', await res.text());
        }
    }
    console.log('\n✅ FIM DO TESTE.');
}

test().catch(console.error);
