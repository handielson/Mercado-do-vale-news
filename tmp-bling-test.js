import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function run() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const s = createClient(supabaseUrl, supabaseKey);

    const { data } = await s.from('company_settings').select('bling_access_token').maybeSingle();
    if (!data || !data.bling_access_token) {
        console.log("No token found");
        return;
    }

    const token = data.bling_access_token;

    // Test 1: Sem enviar situacoes (comportamento padrão Bling)
    let url = 'https://api.bling.com.br/Api/v3/contas/receber?limite=100&pagina=1&dataVencimentoInicial=2025-12-01&dataVencimentoFinal=2025-12-31';
    console.log("Fetching: ", url);
    let r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    let body = await r.json();
    const res1 = body.data || [];
    console.log("Result 1 (Sem situacoes): ", res1.length);
    res1.forEach(c => console.log(`  - ${c.contato.nome} | ${c.vencimento} | Situação: ${c.situacao} | Valor: ${c.valor}`));

    // Test 2: Enviando todas as situacoes
    let url2 = 'https://api.bling.com.br/Api/v3/contas/receber?limite=100&pagina=1&dataVencimentoInicial=2025-12-01&dataVencimentoFinal=2025-12-31&situacoes[]=1&situacoes[]=2&situacoes[]=3&situacoes[]=4';
    console.log("\nFetching: ", url2);
    let r2 = await fetch(url2, { headers: { 'Authorization': `Bearer ${token}` } });
    let body2 = await r2.json();
    const res2 = body2.data || [];
    console.log("Result 2 (Com situacoes[]=1,2,3,4): ", res2.length);
    res2.forEach(c => console.log(`  - ${c.contato.nome} | ${c.vencimento} | Situação: ${c.situacao} | Valor: ${c.valor}`));
}

run();
