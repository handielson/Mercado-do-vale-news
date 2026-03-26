import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Supabase client from env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local", { 
    url: !!supabaseUrl, 
    key: !!supabaseKey 
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateShopeeConfig() {
  const { data: companies, error: fetchErr } = await supabase.from('company_settings').select('id').limit(1);
  if (fetchErr || !companies.length) {
    console.error("Error fetching company settings:", fetchErr);
    process.exit(1);
  }

  const settingsId = companies[0].id;

  const { error: updateErr } = await supabase
    .from('company_settings')
    .update({
      shopee_partner_id: '2031856',
      shopee_partner_key: 'shpk48536375634c496178454f494c6977646867686c4b4c464a534577416b4f',
      shopee_shop_id: '321114781',
      shopee_access_token: '4c4e4f4a53486a7472696e5577574c70',
      shopee_refresh_token: '664a4a74544368476559446d6a596844'
    })
    .eq('id', settingsId);

  if (updateErr) {
    console.error("Failed to update Shopee config:", updateErr);
  } else {
    console.log("✅ Shopee Production Config saved to database!");
  }
}

updateShopeeConfig();
