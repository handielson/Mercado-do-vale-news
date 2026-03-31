/**
 * sync-base64-images-to-vps.cjs
 * Migra imagens base64 do Supabase para a VPS MySQL, produto a produto.
 * Usa PATCH /products/images com apenas 1 produto por vez para evitar 413.
 * 
 * Uso: node sync-base64-images-to-vps.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });


const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !SYNC_KEY) {
  console.error('❌ Variáveis necessárias: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VPS_SYNC_KEY');
  process.exit(1);
}

async function fetchSupabaseProducts() {
  console.log('📥 Buscando produtos do Supabase com imagens base64...');
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

  // Filtra apenas os que têm imagens (base64 ou qualquer imagem)
  return all.filter(p => {
    const imgs = p.images || [];
    return imgs.length > 0;
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`VPS error ${res.status}: ${body.substring(0, 100)}`);
  }
  return await res.json();
}

async function sync() {
  const products = await fetchSupabaseProducts();
  console.log(`\n✅ ${products.length} produtos com imagens encontrados no Supabase\n`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let errorList = [];

  for (const product of products) {
    const sku = product.sku;
    if (!sku) { skipped++; continue; }

    const images = product.images || [];
    if (images.length === 0) { skipped++; continue; }

    process.stdout.write(`  ${sku} (${images.length} imgs)... `);
    try {
      const result = await updateVpsImages(sku, images);
      if (result.affectedRows > 0) {
        console.log('✅');
        synced++;
      } else {
        console.log('⚠️ SKU não encontrado na VPS');
        skipped++;
      }
    } catch (err) {
      const msg = err.message;
      if (msg.includes('413')) {
        // Imagem muito grande — tentar apenas a primeira
        try {
          const result = await updateVpsImages(sku, [images[0]]);
          if (result.affectedRows > 0) {
            console.log('✅ (só 1a imagem - grande demais)');
            synced++;
          } else {
            console.log('⚠️ SKU não encontrado na VPS');
            skipped++;
          }
        } catch (err2) {
          console.log(`❌ Muito grande mesmo: ${sku}`);
          errorList.push(sku);
          errors++;
        }
      } else {
        console.log(`❌ ${msg.substring(0, 60)}`);
        errorList.push(sku);
        errors++;
      }
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Sincronizados: ${synced} produtos`);
  console.log(`⚠️  Pulados: ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
  if (errorList.length) console.log(`   SKUs com erro: ${errorList.join(', ')}`);
  console.log('════════════════════════════════════════');
}

sync().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
