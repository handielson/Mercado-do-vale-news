/**
 * migrate-products-to-vps.js
 * Migra todos os produtos do Supabase para a VPS MySQL.
 * 
 * Uso:
 *   node migrate-products-to-vps.js
 * 
 * Requer as variáveis de ambiente:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VPS_BASE_URL, VITE_VPS_SYNC_KEY
 */

require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;
const BATCH_SIZE  = 100;

if (!SUPABASE_URL || !SUPABASE_KEY || !SYNC_KEY) {
  console.error('❌ Variáveis de ambiente necessárias: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VPS_SYNC_KEY');
  process.exit(1);
}

async function fetchAllProducts() {
  console.log('📥 Buscando produtos do Supabase...');
  let all = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=*&order=name.asc&limit=${PAGE}&offset=${from}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error(`Supabase error: ${res.statusText}`);
    const page = await res.json();
    all = all.concat(page);
    console.log(`  → ${all.length} produtos carregados...`);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function sendBatch(products) {
  const res = await fetch(`${VPS_BASE}/products/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': SYNC_KEY,
    },
    body: JSON.stringify(products),
  });
  if (!res.ok) throw new Error(`VPS batch error: ${res.status} ${res.statusText}`);
  return await res.json();
}

async function migrate() {
  const products = await fetchAllProducts();
  console.log(`\n✅ ${products.length} produtos encontrados no Supabase\n`);

  let totalUpserted = 0;
  let totalErrors = [];

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(products.length / BATCH_SIZE);

    process.stdout.write(`  Lote ${batchNum}/${totalBatches} (${batch.length} produtos)... `);

    try {
      const result = await sendBatch(batch);
      totalUpserted += result.upserted || 0;
      if (result.errors?.length) totalErrors = totalErrors.concat(result.errors);
      console.log(`✅ ${result.upserted} ok, ${result.errors?.length || 0} erros`);
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Total migrado: ${totalUpserted} produtos`);
  if (totalErrors.length) {
    console.log(`⚠️  Erros (${totalErrors.length}):`);
    totalErrors.slice(0, 10).forEach(e => console.log(`   - ${e.name || e.id}: ${e.error}`));
  }
  console.log('════════════════════════════════════════');
  console.log('\n🚀 Próximo passo: reiniciar o servidor VPS');
  console.log('   ssh root@api.xiaomipetrolina.com.br "cd /var/www/mdv-api && git pull && pm2 restart mdv-api"');
}

migrate().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
