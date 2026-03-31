/**
 * sync-descriptions.cjs
 * Sincroniza description e technical_specifications do Supabase → VPS MySQL.
 * Usa PATCH /products/description (endpoint seguro — não toca em imagens).
 *
 * Pré-requisito: endpoint PATCH /products/description já deployado na VPS.
 * Uso: node sync-descriptions.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !SYNC_KEY) {
  console.error('❌ Variáveis necessárias: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY|ANON_KEY, VITE_VPS_SYNC_KEY');
  process.exit(1);
}

// ── Supabase ──────────────────────────────────────────────────────────────────

async function fetchSupabaseProducts() {
  console.log('📥 Buscando produtos do Supabase com description/specs...');
  let all = [];
  let from = 0;
  const PAGE = 200;

  while (true) {
    const to = from + PAGE - 1;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,sku,description&order=name.asc`,
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
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase error: ${res.status} ${res.statusText} - ${errText}`);
    }
    const page = await res.json();
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < PAGE) break;
    from += PAGE;
  }

  // Filtra apenas os que têm description preenchida
  return all.filter(p => p.description && p.description.trim().length > 0);
}

// ── VPS ───────────────────────────────────────────────────────────────────────

async function patchDescription(sku, description, technical_specifications) {
  const res = await fetch(`${VPS_BASE}/products/description`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': SYNC_KEY,
    },
    body: JSON.stringify({ sku, description, technical_specifications }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`VPS ${res.status}: ${body.substring(0, 120)}`);
  }
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function sync() {
  const products = await fetchSupabaseProducts();
  console.log(`\n✅ ${products.length} produtos com description/specs no Supabase\n`);

  if (products.length === 0) {
    console.log('ℹ️  Nenhum produto com descrição ou specs encontrado no Supabase. Encerrando.');
    return;
  }

  let synced   = 0;
  let skipped  = 0;
  let notFound = 0;
  let errors   = 0;

  for (const product of products) {
    const sku = product.sku;
    if (!sku) { skipped++; continue; }

    process.stdout.write(`  ${sku}... `);
    try {
      const result = await patchDescription(sku, product.description, null);
      if (result.affectedRows > 0) {
        console.log('✅');
        synced++;
      } else {
        console.log('⚠️  SKU não encontrado na VPS');
        notFound++;
      }
    } catch (err) {
      console.log(`❌ ${err.message.substring(0, 80)}`);
      errors++;
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Sincronizados: ${synced}`);
  console.log(`⚠️  Não encontrados na VPS: ${notFound}`);
  console.log(`⏭️  Pulados (sem SKU): ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
  console.log('════════════════════════════════════════');
  console.log('\n✅ Sync de descrições concluído!');
}

sync().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
