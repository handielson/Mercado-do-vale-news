const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('company_settings')
    .select('shopee_access_token, shopee_refresh_token, shopee_partner_id, shopee_partner_key, shopee_shop_id')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('TOKENS:', data);
}

run();
