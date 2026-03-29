import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local manually to avoid depending on 'dotenv' pkg
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2];
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    envVars[match[1]] = val;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Faltou configurar VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL() {
  const cpf = '54305055953';
  console.log(`\n🔍 [PASSO 1] Buscando o cliente com CPF: ${cpf}...`);
  
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('id, name, cpf_cnpj, user_id, created_at')
    .eq('cpf_cnpj', cpf);

  if (custErr) {
    console.error("❌ Erro ao buscar o cliente:", custErr);
    return;
  }

  if (!customers || customers.length === 0) {
    console.log("⚠️ Nenhum cliente encontrado com esse CPF no Supabase.");
    return;
  }

  console.log(`✅ Cliente encontrado:`);
  console.table(customers);

  for (const customer of customers) {
    console.log(`\n🛒 [PASSO 2] Buscando Vendas da loja física (PDV) vinculadas ao ID: ${customer.id}...`);
    const { data: sales, error: salesErr } = await supabase
      .from('sales')
      .select('id, total, status, created_at')
      .eq('customer_id', customer.id);

    if (salesErr) {
      console.error(`❌ Erro nas vendas: ${salesErr.message}`);
    } else {
      console.log(`Encontradas ${sales.length} vendas (PDV):`);
      if (sales.length > 0) console.table(sales.map(s => ({...s, total: s.total/100})));
    }

    console.log(`\n📦 [PASSO 3] Buscando Pedidos (Online) vinculados ao ID: ${customer.id}...`);
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, total, status, created_at')
      .eq('customer_id', customer.id);

    if (ordersErr) {
      console.error(`❌ Erro nos pedidos online: ${ordersErr.message}`);
    } else {
      console.log(`Encontrados ${orders.length} pedidos online:`);
      if (orders.length > 0) console.table(orders.map(o => ({...o, total: o.total/100})));
    }
  }
}

runSQL();
