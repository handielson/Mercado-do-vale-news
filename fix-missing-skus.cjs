/**
 * fix-missing-skus.cjs
 * Detecta produtos na VPS MySQL onde sku=NULL e corrige usando o Supabase como referência.
 * SEGURO: só atualiza o campo SKU via PUT mantendo todos os outros dados da VPS.
 * Uso: node fix-missing-skus.cjs
 */
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;

if (!SYNC_KEY) { console.error('❌ VITE_VPS_SYNC_KEY não configurado em .env.local'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Credenciais Supabase não configuradas'); process.exit(1); }

async function fetchAllVps() {
  let all = [], offset = 0;
  while (true) {
    const res = await fetch(`${VPS_BASE}/products?limit=500&offset=${offset}&status=all`, {
      headers: { 'X-Sync-Key': SYNC_KEY }
    });
    if (!res.ok) throw new Error(`VPS status ${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all = all.concat(page);
    if (page.length < 500) break;
    offset += 500;
  }
  return all;
}

async function fetchSupabaseSkuMap() {
  // Busca só id + sku do Supabase — leve e rápido
  let all = [], from = 0;
  while (true) {
    const to = from + 499;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,sku,bling_id,name&order=name.asc`,
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
    if (page.length < 500) break;
    from += 500;
  }
  // Mapeia por id e por bling_id para cruzamento
  const byId      = new Map(all.map(p => [p.id, p]));
  const byBlingId = new Map(all.filter(p => p.bling_id).map(p => [String(p.bling_id), p]));
  return { byId, byBlingId, all };
}

async function updateSkuOnly(vpsProduct, newSku) {
  // PUT que preserva todos os dados da VPS — só sobrescreve o sku
  const body = {
    ...vpsProduct,
    sku: newSku,
  };
  const res = await fetch(`${VPS_BASE}/products/${vpsProduct.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': SYNC_KEY,
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function main() {
  console.log('🔍 Buscando produtos da VPS...');
  const vpsAll = await fetchAllVps();
  console.log(`   VPS: ${vpsAll.length} produtos`);

  const withNullSku = vpsAll.filter(p => !p.sku);
  if (withNullSku.length === 0) {
    console.log('✅ Nenhum produto com sku=NULL encontrado na VPS. Tudo ok!');
    return;
  }
  console.log(`\n⚠️  ${withNullSku.length} produto(s) com sku=NULL na VPS. Buscando SKUs no Supabase...`);

  const supa = await fetchSupabaseSkuMap();
  console.log(`   Supabase: ${supa.all.length} produtos`);

  let fixed = 0, skipped = 0, failed = 0;

  for (const vp of withNullSku) {
    // Tenta cruzar por id (mesmo UUID) ou por bling_id
    const sp = supa.byId.get(vp.id)
            || (vp.bling_id ? supa.byBlingId.get(String(vp.bling_id)) : null);

    if (!sp || !sp.sku) {
      console.log(`  ⏭  "${vp.name?.slice(0,40)}" — sem SKU no Supabase também`);
      skipped++;
      continue;
    }

    const ok = await updateSkuOnly(vp, sp.sku);
    if (ok) {
      console.log(`  ✅ "${vp.name?.slice(0,40)}" → sku="${sp.sku}"`);
      fixed++;
    } else {
      console.log(`  ❌ Falha ao atualizar "${vp.name?.slice(0,40)}"`);
      failed++;
    }

    // Pausa leve para não sobrecarregar a VPS
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n════════════════════════════`);
  console.log(`✅ Corrigidos:  ${fixed}`);
  console.log(`⏭  Sem match:   ${skipped}`);
  console.log(`❌ Erros:       ${failed}`);
  console.log('Concluído.');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
