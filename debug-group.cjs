require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

function generateGroupKey(product) {
    if (product.model_id) return product.model_id;
    const brand = product.brand || 'unknown';
    let baseName = product.name || product.model || 'unknown';
    if (baseName.includes(' - ')) {
        const parts = baseName.split(' - ');
        if (parts.length > 1) {
            parts.pop(); 
            baseName = parts.join(' - ');
        }
    }
    const model = baseName.replace(/^(o|a|os|as|um|uma)\s+/i, '');
    return `${brand}_${model}`.toLowerCase().replace(/\s+/g, '-');
}

(async () => {
    const { data } = await supabase.from('products').select('*').ilike('name', '%Capa%').limit(150);
    if (!data) return;
    
    // Test the grouping
    for (const p of data) {
        if (!p.name.includes('360') && !p.name.includes('Note 60')) continue;
        const key = generateGroupKey(p);
        console.log(`[${key}] - ${p.name} (model: ${p.model}, brand: ${p.brand})`);
    }
})();
