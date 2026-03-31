/**
 * debug-pmcs.cjs - Diagnóstico do produto PMCS
 * Verifica os campos que causam a herança incorreta de dados.
 * Uso: node debug-pmcs.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const VPS = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const KEY = process.env.VITE_VPS_SYNC_KEY;
if (!KEY) { console.error('❌ VITE_VPS_SYNC_KEY não encontrada em .env.local'); process.exit(1); }

const H = { 'X-Sync-Key': KEY, 'Content-Type': 'application/json' };

async function get(path) {
  const r = await fetch(`${VPS}${path}`, { headers: H });
  if (!r.ok) { const t = await r.text(); throw new Error(`${r.status}: ${t}`); }
  return r.json();
}

async function main() {
  // 1. Buscar o PMCS pelo slug/sku
  console.log('🔍 Buscando produto PMCS...\n');
  const bySlug = await get('/products/by-slug/pmcs');
  
  const p = bySlug;
  console.log('━━━━ DADOS BRUTOS DO PRODUTO ━━━━');
  console.log(`ID:         ${p.id}`);
  console.log(`SKU:        ${p.sku}`);
  console.log(`Nome:       ${p.name}`);
  console.log(`parent_id:  "${p.parent_id}" (tipo: ${typeof p.parent_id})`);
  console.log(`model_id:   "${p.model_id}" (tipo: ${typeof p.model_id})`);
  console.log(`is_combo:   "${p.is_combo}" (tipo: ${typeof p.is_combo})`);
  console.log(`status:     ${p.status}`);
  console.log('');

  // 2. Verificar o que cada query de "siblings" retorna
  console.log('━━━━ QUERY POR parent_id ━━━━');
  if (p.parent_id && String(p.parent_id) !== '0' && String(p.parent_id) !== 'null') {
    try {
      const sibs = await get(`/products?parent_id=${p.parent_id}&status=active&limit=10`);
      const arr = Array.isArray(sibs) ? sibs : sibs.products || [];
      console.log(`→ ${arr.length} resultados:`);
      arr.forEach(s => console.log(`   - [${s.sku}] ${s.name}`));
    } catch(e) { console.log(`→ Erro: ${e.message}`); }
  } else {
    console.log(`→ Pulado (parent_id="${p.parent_id}" é inválido/zero)`);
  }
  console.log('');

  console.log('━━━━ QUERY POR model_id ━━━━');
  if (p.model_id && String(p.model_id) !== '0' && String(p.model_id) !== 'null') {
    try {
      const sibs = await get(`/products?model_id=${p.model_id}&status=active&limit=10`);
      const arr = Array.isArray(sibs) ? sibs : sibs.products || [];
      console.log(`→ ${arr.length} resultados:`);
      arr.forEach(s => console.log(`   - [${s.sku}] ${s.name}`));
    } catch(e) { console.log(`→ Erro: ${e.message}`); }
  } else {
    console.log(`→ Pulado (model_id="${p.model_id}" é inválido/zero)`);
  }
  console.log('');

  // 3. Se parent_id for algo diferente de 0/null, busca o que retorna de fato
  console.log('━━━━ QUERY FORÇADA parent_id sem filtro ━━━━');
  try {
    const raw = await get(`/products?parent_id=${p.parent_id}&status=active&limit=20`);
    const arr = Array.isArray(raw) ? raw : raw.products || [];
    console.log(`→ ${arr.length} resultados com parent_id=${p.parent_id}:`);
    arr.slice(0, 10).forEach(s => console.log(`   - [${s.sku}] ${s.name} (parent_id=${s.parent_id})`));
  } catch(e) { console.log(`→ Erro: ${e.message}`); }

  console.log('');
  console.log('━━━━ SPECS COMPLETAS (para ver campos extras) ━━━━');
  const specs = p.specs || {};
  const specKeys = Object.keys(specs).filter(k => specs[k]);
  console.log(`Chaves em specs: ${specKeys.join(', ') || '(nenhuma)'}`);
  
  console.log('\n✅ Diagnóstico concluído.');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
