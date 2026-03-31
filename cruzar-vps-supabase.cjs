/**
 * cruzar-vps-supabase.cjs
 * Compara os produtos da VPS com os do Supabase para encontrar o campo em comum.
 * Mostra amostras de ambos e tenta cruzar por bling_id, name e sku.
 * Uso: node cruzar-vps-supabase.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;

async function fetchVpsAll() {
  let all = [], offset = 0;
  while (true) {
    const res = await fetch(`${VPS_BASE}/products?limit=100&offset=${offset}&status=all`, {
      headers: { 'X-Sync-Key': SYNC_KEY }
    });
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all = all.concat(page);
    if (page.length < 100) break;
    offset += 100;
  }
  return all;
}

async function fetchSupabaseAll() {
  let all = [], from = 0;
  while (true) {
    const to = from + 199;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,sku,bling_id,name,images,description&order=name.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Range: `${from}-${to}`,
          'Range-Unit': 'items',
          Prefer: 'count=none',
        }
      }
    );
    const page = await res.json();
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < 200) break;
    from += 200;
  }
  return all;
}

async function main() {
  console.log('🔍 Buscando dados...');
  const [vps, supa] = await Promise.all([fetchVpsAll(), fetchSupabaseAll()]);

  console.log(`\nVPS: ${vps.length} produtos | Supabase: ${supa.length} produtos\n`);

  // Índices por SKU e bling_id
  const vpsBySkuLow    = new Map(vps.map(p => [String(p.sku||'').toLowerCase().trim(), p]));
  const vpsByBlingId   = new Map(vps.filter(p=>p.bling_id).map(p => [String(p.bling_id), p]));
  const supaBySkuLow   = new Map(supa.map(p => [String(p.sku||'').toLowerCase().trim(), p]));
  const supaByBlingId  = new Map(supa.filter(p=>p.bling_id).map(p => [String(p.bling_id), p]));

  // Cruzar por SKU
  let matchBySku = 0, matchByBlingId = 0, noMatch = 0;
  const noMatchSamples = [];

  for (const sp of supa) {
    const skuKey = String(sp.sku||'').toLowerCase().trim();
    if (skuKey && vpsBySkuLow.has(skuKey)) { matchBySku++; continue; }
    if (sp.bling_id && vpsByBlingId.has(String(sp.bling_id))) { matchByBlingId++; continue; }
    noMatch++;
    if (noMatchSamples.length < 5) noMatchSamples.push({ sku: sp.sku, bling_id: sp.bling_id, name: sp.name?.slice(0,40) });
  }

  // Supabase que tem bling_id mas VPS não tem
  const supaComBling   = supa.filter(p => p.bling_id);
  const vpsComBling    = vps.filter(p => p.bling_id);
  const supaComImagem  = supa.filter(p => Array.isArray(p.images) && p.images.length > 0);
  const supaComDesc    = supa.filter(p => p.description?.trim());

  console.log('════════════════════════════════════════');
  console.log('📊 CRUZAMENTO VPS × SUPABASE');
  console.log('════════════════════════════════════════');
  console.log(`\nCampo bling_id:`);
  console.log(`  Supabase com bling_id: ${supaComBling.length}`);
  console.log(`  VPS com bling_id:      ${vpsComBling.length}`);
  console.log(`\nCruzamento (baseado em produtos do Supabase):`);
  console.log(`  ✅ Match por SKU:       ${matchBySku}`);
  console.log(`  ✅ Match por bling_id:  ${matchByBlingId}`);
  console.log(`  ❌ Sem match algum:     ${noMatch}`);
  console.log(`\nDados no Supabase:`);
  console.log(`  Com imagem:             ${supaComImagem.length}`);
  console.log(`  Com description:        ${supaComDesc.length}`);

  // Amostras VPS
  console.log('\n📋 Amostra de 5 produtos VPS:');
  vps.slice(0, 5).forEach(p => console.log(`  SKU: "${p.sku}" | bling_id: "${p.bling_id||'-'}" | ${p.name?.slice(0,40)}`));

  // Amostras Supabase
  console.log('\n📋 Amostra de 5 produtos Supabase (com imagem):');
  supaComImagem.slice(0, 5).forEach(p => console.log(`  SKU: "${p.sku}" | bling_id: "${p.bling_id||'-'}" | ${p.name?.slice(0,40)}`));

  // Verifica se algum VPS.sku existe no Supabase  
  console.log('\n🔁 Verificando se VPS.sku existe no Supabase...');
  let vpsSkuInSupa = 0;
  for (const vp of vps.slice(0, 50)) {
    const key = String(vp.sku||'').toLowerCase().trim();
    if (key && supaBySkuLow.has(key)) vpsSkuInSupa++;
  }
  console.log(`  De 50 produtos VPS testados, ${vpsSkuInSupa} têm SKU no Supabase`);

  if (noMatchSamples.length > 0) {
    console.log('\n❌ Amostras sem match:');
    noMatchSamples.forEach(s => console.log(`  sku="${s.sku}" bling_id="${s.bling_id||'-'}" nome="${s.name}"`));
  }

  console.log('\n✅ Diagnóstico cruzado concluído.');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
