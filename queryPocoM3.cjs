const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
    // Buscar produtos com titulo Poco M3
    const { data: d1, error } = await supabase.from('products').select('id, name, sku, bling_id, deleted_at, status').ilike('sku', 'CCPM3%');
    console.log('Error:', error);
    console.log('Poco M3:', JSON.stringify(d1, null, 2));

})();
