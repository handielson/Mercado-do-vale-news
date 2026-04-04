/**
 * sync-categories-to-vps.cjs
 * Sincroniza category_id do Supabase → VPS para todos os produtos desalinhados.
 * Corrige produtos que foram movidos de categoria no Supabase mas VPS nao foi atualizado.
 *
 * Uso: node sync-categories-to-vps.cjs [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const VPS          = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY     = process.env.VITE_VPS_SYNC_KEY;
const DRY_RUN      = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY || !SYNC_KEY) {
  console.error('❌ Variáveis necessárias: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY, VITE_VPS_SYNC_KEY');
  process.exit(1);
}

if (DRY_RUN) console.log('🔍 MODO DRY-RUN — nenhuma alteracao sera feita na VPS\n');

// ── Supabase: busca todos os produtos com sku + category_id ──────────────────

async function fetchSupabaseCategories() {
  console.log('📥 Buscando category_id de todos os produtos no Supabase...');
  let all = [], from = 0;
  const PAGE = 500;

  while (true) {
    const to = from + PAGE - 1;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=sku,category_id&order=sku.asc`,
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
    if (!r.ok) throw new Error(`Supabase: ${r.status} ${await r.text()}`);
    const page = await r.json();
    if (!page.length) break;
    all = all.concat(page);
    if (page.length < PAGE) break;
    from += PAGE;
  }

  // Mapeia SKU → category_id (apenas os que têm ambos)
  const map = {};
  for (const p of all) {
    if (p.sku && p.category_id) map[p.sku] = p.category_id;
  }
  return map;
}

// ── VPS: busca category_id de todos os produtos ──────────────────────────────

async function fetchVpsCategories() {
  console.log('📥 Buscando category_id de todos os produtos na VPS...');
  let all = [], offset = 0;
  const PAGE = 500;

  while (true) {
    const r = await fetch(
      `${VPS}/products?compact=true&status=all&limit=${PAGE}&offset=${offset}`
    );
    if (!r.ok) throw new Error(`VPS: ${r.status}`);
    const page = await r.json();
    if (!page.length) break;
    all = all.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }

  // Mapeia SKU → {category_id, id (uuid)}
  const map = {};
  for (const p of all) {
    if (p.sku) map[p.sku] = { category_id: p.category_id, id: p.id };
  }
  return map;
}

// ── VPS: atualiza category_id de um produto via PATCH stock (toca updated_at) ─
// Aqui usamos o endpoint de batch para atualizar só o category_id

async function patchCategoryInVps(productId, category_id) {
  // Usamos PUT com campos mínimos — o server.js precisa do PUT /products/:id
  // Mas esse endpoint requer todos os campos. Melhor usar o batch com só a mudança.
  // Alternativa: usamos /products/batch com apenas os campos necessários.
  const r = await fetch(`${VPS}/products/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_KEY },
    body: JSON.stringify([{ id: productId, category_id }]),
  });
  if (!r.ok) throw new Error(`VPS batch: ${r.status} ${await r.text()}`);
  return r.json();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [sbMap, vpsMap] = await Promise.all([fetchSupabaseCategories(), fetchVpsCategories()]);

  console.log(`\n📊 Supabase: ${Object.keys(sbMap).length} produtos com category_id`);
  console.log(`📊 VPS:      ${Object.keys(vpsMap).length} produtos\n`);

  // Encontra desalinhamentos
  const mismatches = [];
  for (const [sku, sbCatId] of Object.entries(sbMap)) {
    const vpsEntry = vpsMap[sku];
    if (!vpsEntry) continue; // produto só no Supabase, não na VPS
    if (vpsEntry.category_id !== sbCatId) {
      mismatches.push({ sku, id: vpsEntry.id, oldCat: vpsEntry.category_id, newCat: sbCatId });
    }
  }

  if (mismatches.length === 0) {
    console.log('✅ Todos os category_id estão alinhados entre Supabase e VPS!');
    return;
  }

  console.log(`⚠️  ${mismatches.length} produto(s) com category_id DIFERENTE entre Supabase e VPS:\n`);
  mismatches.forEach((m, i) => {
    console.log(`  ${String(i+1).padStart(3)}. SKU: ${m.sku}`);
    console.log(`       VPS:      ${m.oldCat || 'null'}`);
    console.log(`       Supabase: ${m.newCat}`);
  });

  if (DRY_RUN) {
    console.log('\n🔍 DRY-RUN: nenhuma alteracao aplicada. Remove --dry-run para corrigir.');
    return;
  }

  console.log(`\n🚀 Atualizando ${mismatches.length} produtos na VPS...`);

  let ok = 0, err = 0;
  for (const m of mismatches) {
    process.stdout.write(`  ${m.sku}... `);
    try {
      await patchCategoryInVps(m.id, m.newCat);
      process.stdout.write('✅\n');
      ok++;
    } catch (e) {
      process.stdout.write(`❌ ${e.message.substring(0, 60)}\n`);
      err++;
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Atualizados: ${ok}`);
  console.log(`❌ Erros:       ${err}`);
  console.log('════════════════════════════════════════');
  console.log('\n✅ category_id sincronizados! Recarregue a loja para confirmar.');
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
