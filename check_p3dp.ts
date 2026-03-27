import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('products').select('id, name, sku, bling_id, price_retail, price_reseller, price_wholesale, status').eq('sku', 'P3DPR10A');
  if (error) console.error(error);
  console.dir(data, { depth: null });
}

check();
