import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/)[1].replace(/["']/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/)[1].replace(/["']/g, '');

fetch(url + '/rest/v1/company_settings?select=bling_access_token', {
    headers: { apikey: key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(data => {
    const token = data[0].bling_access_token;

    // Pegando a conta do Wilson, print mostrou valor 2463,52, id 24476868400
    // do console anterior

    fetch(`https://api.bling.com.br/Api/v3/contas/receber/24476868400`, {
        headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.json()).then(res => {
        console.log("=== DETAIL RESPONSE ===");
        console.log(JSON.stringify(res.data, null, 2));
    });
});
