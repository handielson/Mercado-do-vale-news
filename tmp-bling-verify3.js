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

    fetch(`https://api.bling.com.br/Api/v3/contas/receber?limite=5&pagina=1&dataInicial=${dInicial}&dataFinal=${dFinal}`, {
        headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.json()).then(res => {
        console.log(JSON.stringify(res.data[0], null, 2));
    });
});
