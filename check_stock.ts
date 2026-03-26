import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBlingStock() {
  const blingId = 15947098546;

  // Obter token do bling
  const { data: settings } = await supabase
    .from('company_settings')
    .select('bling_access_token')
    .single();

  if (!settings?.bling_access_token) {
    console.error("No bling token found");
    return;
  }

  // Primeiro consultar o produto pra ver se tem dimensão
  const prodRes = await fetch(`https://api.bling.com.br/Api/v3/produtos/${blingId}`, {
    headers: { 'Authorization': `Bearer ${settings.bling_access_token}`, 'Accept': 'application/json' }
  });
  const prodData = await prodRes.json();
  console.log("Product in Bling:", JSON.stringify(prodData, null, 2));

  // Consultar estoque
  const stockRes = await fetch(`https://api.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${blingId}`, {
    headers: { 'Authorization': `Bearer ${settings.bling_access_token}`, 'Accept': 'application/json' }
  });
  const stockData = await stockRes.json();
  console.log("Stock in Bling:", JSON.stringify(stockData, null, 2));
}

checkBlingStock();
