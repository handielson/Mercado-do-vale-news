import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/)[1].replace(/["']/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/)[1].replace(/["']/g, '');

fetch(url + '/rest/v1/company_settings?select=bling_access_token', {
    headers: { apikey: key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(data => {
    const token = data[0].bling_access_token;

    const dInicial = '2025-12-01';
    const dFinal = '2025-12-31';

    // Test 1: no situacoes
    fetch(`https://api.bling.com.br/Api/v3/contas/receber?limite=100&pagina=1&dataVencimentoInicial=${dInicial}&dataVencimentoFinal=${dFinal}`, {
        headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.json()).then(res => {
        console.log('--- Test 1 (Sem situacoes) ---');
        console.log('Total returned:', res.data?.length);
        res.data?.forEach(c => console.log('  -', c.contato.nome, '| Venc:', c.vencimento, '| Situação:', c.situacao));
    });

    // Test 2: situacoes=1,2,3,4
    fetch(`https://api.bling.com.br/Api/v3/contas/receber?limite=100&pagina=1&dataVencimentoInicial=${dInicial}&dataVencimentoFinal=${dFinal}&situacoes[]=1&situacoes[]=2&situacoes[]=3&situacoes[]=4`, {
        headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.json()).then(res => {
        console.log('\n--- Test 2 (Com situacoes=1,2,3,4) ---');
        console.log('Total returned:', res.data?.length);
        res.data?.forEach(c => console.log('  -', c.contato.nome, '| Venc:', c.vencimento, '| Situação:', c.situacao));
    });
});
