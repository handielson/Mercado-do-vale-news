const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProduct() {
  const skus = ['TC193BU', 'DK-14', 'KP-TE119', 'KP-2059', 'XI-REDMI'];
  for (const sku of skus) {
    console.log(`\n--- Checking ${sku} ---`);
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, sku, specs, custom_fields, model_id,
        model:models(template_values)
      `)
      .ilike('sku', `%${sku}%`)
      .limit(1);

    if (error) {
      console.error(error);
      continue;
    }

    if (!data || data.length === 0) {
      console.log('Not found');
      continue;
    }

    console.log(`Product: ${data[0].name} (Model ID: ${data[0].model_id})`);
    console.log('Specs:', JSON.stringify(data[0].specs, null, 2));
    console.log('Custom Fields:', JSON.stringify(data[0].custom_fields, null, 2));
    if (data[0].model) {
      console.log('Model Template Values:', JSON.stringify(data[0].model.template_values, null, 2));
    }
  }
}

checkProduct();
