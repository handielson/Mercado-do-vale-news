const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let url = '', key = '';
env.forEach(line => {
    line = line.trim();
    if(line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
    if(line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
    const { data } = await supabase.from('catalog_settings').select('*').limit(1);
    console.log(data);
})();
