const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: ['.env.local', '.env'] });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .not('sku', 'is', 'null')
    .limit(10);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data.length === 0) {
    console.log('SUPABASE TEM SKU NULL PARA TUDO!');
    
    const { data: anyItem } = await supabase.from('products').select('*').limit(1);
    console.log('Exemplo do Supabase:', anyItem[0]);
  } else {
    console.log('Supabase tem SKUs:', data.map(d => ({ name: d.name, sku: d.sku, price: d.price_retail })));
  }
}

check();
