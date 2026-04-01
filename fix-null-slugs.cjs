/**
 * fix-null-slugs.cjs
 * Produtos na VPS com slug="null" (string literal) não são acessíveis via URL.
 * Este script copia slug e model_id do Supabase para esses produtos na VPS.
 * Uso: node fix-null-slugs.cjs
 */
require('dotenv').config({ path: '.env.local' });

const VPS_BASE  = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY  = process.env.VITE_VPS_SYNC_KEY;
const SUPA_URL  = process.env.VITE_SUPABASE_URL;
const SUPA_KEY  = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function fetchAllVps() {
  let all = [], offset = 0;
  while (true) {
    const r = await fetch(`${VPS_BASE}/products?limit=500&offset=${offset}&status=all`, {
      headers: { 'X-Sync-Key': SYNC_KEY }
    });
    const page = await r.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all = all.concat(page);
    if (page.length < 500) break;
    offset += 500;
  }
  return all;
}

async function fetchSupabaseAll() {
  let all = [], from = 0;
  while (true) {
    const to = from + 499;
    const r = await fetch(
      `${SUPA_URL}/rest/v1/products?select=id,sku,bling_id,slug,model_id,status&order=name.asc`,
      {
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          Range: `${from}-${to}`,
          'Range-Unit': 'items',
          Prefer: 'count=none',
        }
      }
    );
    const page = await r.json();
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < 500) break;
    from += 500;
  }
  return all;
}

async function putProduct(vpsProduct) {
  const r = await fetch(`${VPS_BASE}/products/${vpsProduct.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_KEY },
    body: JSON.stringify(vpsProduct),
  });
  return r.ok;
}

function isNullStr(v) {
  return v === null || v === undefined || String(v).toLowerCase() === 'null' || String(v).trim() === '';
}

async function main() {
  console.log('🔍 Carregando dados...');
  const [vpsAll, supaAll] = await Promise.all([fetchAllVps(), fetchSupabaseAll()]);
  console.log(`VPS: ${vpsAll.length} | Supabase: ${supaAll.length}`);

  // Indexa Supabase por id e bling_id para cruzamento
  const supaById     = new Map(supaAll.map(p => [p.id, p]));
  const supaByBling  = new Map(supaAll.filter(p => p.bling_id).map(p => [String(p.bling_id), p]));

  // Filtra VPS com slug ou model_id = string "null"
  const toFix = vpsAll.filter(p => isNullStr(p.slug) || isNullStr(p.model_id));
  console.log(`\n⚠️  ${toFix.length} produto(s) com slug/model_id nulo no VPS\n`);

  if (toFix.length === 0) {
    console.log('✅ Nenhum produto precisa de correção.');
    return;
  }

  let fixed = 0, skipped = 0, failed = 0;

  for (const vp of toFix) {
    const sp = supaById.get(vp.id)
            || (vp.bling_id ? supaByBling.get(String(vp.bling_id)) : null);

    if (!sp) {
      console.log(`  ⏭  "${vp.name?.slice(0,40)}" — sem match no Supabase`);
      skipped++;
      continue;
    }

    // Monta payload: usa dados VPS para tudo, só atualiza slug e model_id do Supabase
    const body = {
      ...vp,
      // slug e model_id vêm do Supabase pois VPS tem "null" literal
      slug: (!isNullStr(sp.slug)) ? sp.slug : vp.slug,
      model_id: (!isNullStr(sp.model_id)) ? sp.model_id : vp.model_id,
    };

    const ok = await putProduct(body);
    if (ok) {
      const fixes = [];
      if (!isNullStr(sp.slug)     && isNullStr(vp.slug))     fixes.push(`slug="${sp.slug}"`);
      if (!isNullStr(sp.model_id) && isNullStr(vp.model_id)) fixes.push(`model_id="${sp.model_id?.slice(0,8)}..."`);
      console.log(`  ✅ "${vp.name?.slice(0,40)}" → ${fixes.join(', ')}`);
      fixed++;
    } else {
      console.log(`  ❌ Falha ao atualizar "${vp.name?.slice(0,40)}"`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n════════════════════════════`);
  console.log(`✅ Corrigidos: ${fixed}`);
  console.log(`⏭  Sem match:  ${skipped}`);
  console.log(`❌ Erros:      ${failed}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
