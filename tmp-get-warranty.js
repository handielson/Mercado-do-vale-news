import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=([^ \r\n]+)/)[1].replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=([^ \r\n]+)/)[1].replace(/['"]/g, '');

fetch(url + '/rest/v1/company_settings?select=warranty_template', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(data => {
    fs.writeFileSync('current_warranty.html', data[0].warranty_template);
    console.log('Template salvo em current_warranty.html');
});
