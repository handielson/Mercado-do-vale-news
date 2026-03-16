const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch ? urlMatch[1].replace(/[\"\'\r]/g, '').trim() : '';
const key = keyMatch ? keyMatch[1].replace(/[\"\'\r]/g, '').trim() : '';
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

function generateGroupKey(product) {
    if (product.model_id) return 'HAS_MODEL_ID:' + product.model_id;
    const brand = product.brand || 'unknown';
    let baseName = product.name || product.model || 'unknown';
    
    console.log(`[DEBUG GENERATING] name=${product.name}, baseNameBefore=${baseName}`);
    
    if (baseName.includes(' - ')) {
        const parts = baseName.split(' - ');
        if (parts.length > 1) {
            parts.pop(); 
            baseName = parts.join(' - ');
        }
    }
    
    console.log(`[DEBUG GENERATING] baseNameAfter=${baseName}`);
    
    const model = baseName.replace(/^(o|a|os|as|um|uma)\s+/i, '');
    return `${brand}_${model}`.toLowerCase().replace(/\s+/g, '-');
}

(async () => {
    // 360
    const { data: d1 } = await supabase.from('products').select('*').ilike('name', '%360%').limit(5);
    console.log('--- 360 ---');
    (d1 || []).forEach(p => console.log(`[${generateGroupKey(p)}] ${p.name} (model_id: ${p.model_id})`));

    // note 60
    const { data: d2 } = await supabase.from('products').select('*').ilike('name', '%Note 60%').limit(5);
    console.log('--- Note 60 ---');
    (d2 || []).forEach(p => console.log(`[${generateGroupKey(p)}] ${p.name} (model_id: ${p.model_id})`));

})();
