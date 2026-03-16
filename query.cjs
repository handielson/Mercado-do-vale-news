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
    const { data, error } = await supabase.from('products').select('name, model, brand, specs').ilike('name', '%Note 60%').limit(50);
    if (error) { console.error("Error", error); return; }
    console.log(JSON.stringify(data.map(d => ({
        name: d.name, 
        model: d.model, 
        color: d.specs?.color
    })), null, 2));
})();
