import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=([^ \r\n]+)/)[1].replace(/['"]/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=([^ \r\n]+)/)[1].replace(/['"]/g, '');

fetch(url + '/rest/v1/company_settings', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(data => {
    const settings = data[0];
    console.log('Keys available:');
    console.log(Object.keys(settings).filter(k => k.includes('logo') || k.includes('url')));

    if (settings.logo) console.log('logo:', settings.logo);
    if (settings.logo_url) console.log('logo_url:', settings.logo_url);
    if (settings.receipt_logo_url) console.log('receipt_logo_url:', settings.receipt_logo_url);
});
