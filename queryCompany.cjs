const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let url = '', key = '', company = '';
env.forEach(line => {
    line = line.trim();
    if(line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/['"]/g, '').trim();
    if(line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/['"]/g, '').trim();
    if(line.startsWith('VITE_COMPANY_ID=')) company = line.split('=')[1].replace(/['"]/g, '').trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
    const { data: d1, error } = await supabase.from('products')
        .select('name, model, brand, model_id, specs')
        .eq('company_id', company)
        .ilike('name', '%360%')
        .limit(5);
        
    if (error) { console.error(error); return; }
    console.log('360:', JSON.stringify(d1, null, 2));

    const { data: d2 } = await supabase.from('products')
        .select('name, model, brand, model_id, specs')
        .eq('company_id', company)
        .ilike('name', '%Note 60%')
        .limit(5);
    console.log('Note 60:', JSON.stringify(d2, null, 2));
})();
