const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let url = '', key = '';
env.forEach(line => {
    line = line.trim();
    if(line.startsWith('VITE_SUPABASE_URL=')) url = line.substring('VITE_SUPABASE_URL='.length).trim();
    if(line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.substring('VITE_SUPABASE_ANON_KEY='.length).trim();
});
url = url.replace(/['"]/g, '');
key = key.replace(/['"]/g, '');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
    const { data: d1, error: e1 } = await supabase.from('products').select('id, name, sku, bling_id, deleted_at, status, model_id').ilike('sku', 'CCPM3%');
    console.log('Error 1:', e1);
    console.log('Poco M3 SKUs:', JSON.stringify(d1, null, 2));

    const { data: d2, error: e2 } = await supabase.from('products').select('id, name, sku, bling_id, deleted_at, status, model_id').ilike('name', '%Poco M3%');
    console.log('Error 2:', e2);
    console.log('Poco M3 Names:', JSON.stringify(d2?.length, null, 2));
})();
