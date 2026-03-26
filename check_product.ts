import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProduct() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, bling_id, stock_quantity')
    .ilike('name', '%Multilaser TC244%');

  console.log(JSON.stringify({ data, error }, null, 2));

  if (data && data.length > 0) {
    const blingId = data[0].bling_id;
    // Get last webhook log for this bling_id
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select('received_at, payload')
      .order('received_at', { ascending: false })
      .limit(10);
      
      const relevantLogs = logs.filter(l => JSON.stringify(l).includes(blingId.toString()));
      console.log("Relevant webhook logs:", JSON.stringify(relevantLogs, null, 2));
  }
}

checkProduct();
