/**
 * sync-images-to-vps.cjs
 * Re-sincroniza apenas as imagens URL HTTP do Supabase para a VPS MySQL.
 * Não sobrescreve imagens que já existem na VPS com URLs HTTP.
 * 
 * Uso: node sync-images-to-vps.cjs
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !SYNC_KEY) {
  console.error('❌ Variáveis necessárias: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VPS_SYNC_KEY');
  process.exit(1);
}

async function fetchSupabaseProducts() {
  console.log('📥 Buscando produtos do Supabase com imagens URL...');
  let all = [];
  let from = 0;
  const PAGE = 200;

  while (true) {
    const to = from + PAGE - 1;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,sku,images&order=name.asc`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${to}`,
        'Range-Unit': 'items',
        Prefer: 'count=none',
      }
    });
    if (!res.ok) throw new Error(`Supabase error: ${res.status} ${res.statusText}`);
    const page = await res.json();
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < PAGE) break;
    from += PAGE;
  }

  // Filtra apenas os que têm imagens URL HTTP (não base64)
  return all.filter(p => {
    const imgs = p.images || [];
    return imgs.some(img => typeof img === 'string' && img.startsWith('http'));
  });
}

async function updateVpsImages(sku, images) {
  const res = await fetch(`${VPS_BASE}/products/images`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': SYNC_KEY,
    },
    body: JSON.stringify({ sku, images }),
  });
  if (!res.ok) throw new Error(`VPS error: ${res.status} ${res.statusText}`);
  return await res.json();
}

async function sync() {
  const products = await fetchSupabaseProducts();
  console.log(`\n✅ ${products.length} produtos com imagens URL encontrados no Supabase\n`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    const sku = product.sku;
    if (!sku) { skipped++; continue; }

    const httpImages = (product.images || []).filter(img => 
      typeof img === 'string' && img.startsWith('http')
    );
    if (httpImages.length === 0) { skipped++; continue; }

    process.stdout.write(`  ${sku} (${httpImages.length} imgs)... `);
    try {
      const result = await updateVpsImages(sku, httpImages);
      if (result.affectedRows > 0) {
        console.log('✅');
        synced++;
      } else {
        console.log('⚠️ SKU não encontrado na VPS');
        skipped++;
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      errors++;
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Sincronizados: ${synced} produtos`);
  console.log(`⚠️  Pulados: ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
  console.log('════════════════════════════════════════');
}

sync().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
