import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

// Check if table already exists
const { error: checkError } = await supabase.from('shopee_products').select('id').limit(1);

if (!checkError) {
  console.log('✅ Tabela shopee_products já existe e está acessível!');
} else {
  console.log('❌ Tabela não existe:', checkError.message);
  console.log('\nExecute este SQL no Supabase Dashboard > SQL Editor:\n');
  console.log(`CREATE TABLE IF NOT EXISTS shopee_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL UNIQUE,
  shopee_item_id bigint,
  shopee_category_id bigint,
  shopee_category_name text,
  shopee_attributes jsonb DEFAULT '[]',
  shopee_price integer,
  status text DEFAULT 'not_synced',
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);`);
}
