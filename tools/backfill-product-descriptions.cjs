/**
 * tools/backfill-product-descriptions.cjs
 *
 * Preenche `description` para produtos da VPS que estão com NULL/vazio.
 * Tenta as fontes nesta ordem:
 *   1. Irmão na VPS com mesmo bling_parent_id que já tenha descrição
 *   2. models.description no Supabase via model_id
 *
 * Uso:
 *   node tools/backfill-product-descriptions.cjs --dry-run   (default: dry run)
 *   node tools/backfill-product-descriptions.cjs --apply     (executa o PATCH)
 *
 * Env exigidas (.env do projeto):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SYNC_SECRET
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const VPS_BASE = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_SECRET = process.env.SYNC_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const apply = process.argv.includes('--apply');

if (!SYNC_SECRET) { console.error('SYNC_SECRET ausente no .env'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Supabase env ausente'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Considera "vazio" tanto null/whitespace quanto valores claramente inválidos
// que aparecem no banco como artefatos (ex.: '0', '<p>0</p>', strings < 5 chars).
const isEmpty = (s) => {
    if (!s || typeof s !== 'string') return true;
    const trimmed = s.trim();
    if (!trimmed) return true;
    // Strip tags HTML simples pra avaliar o conteúdo textual
    const text = trimmed.replace(/<[^>]+>/g, '').trim();
    if (!text) return true;
    if (text.length < 5) return true;       // descrição absurdamente curta
    if (/^[0-9\s]+$/.test(text)) return true; // só dígitos/espaços
    return false;
};

async function fetchAllProducts() {
  // Endpoint /products aceita limit=2000 no histórico; pagina caso precise.
  const all = [];
  let page = 0;
  const pageSize = 2000;
  while (true) {
    const res = await fetch(`${VPS_BASE}/products?status=all&limit=${pageSize}&offset=${page * pageSize}`);
    if (!res.ok) throw new Error(`Falha ao listar produtos: ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    page += 1;
  }
  return all;
}

async function getModelDescriptionsByIds(modelIds) {
  if (modelIds.length === 0) return new Map();
  const unique = Array.from(new Set(modelIds));
  const map = new Map();
  // Supabase aceita .in() com limite de ~1000 por query.
  const chunkSize = 500;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('models')
      .select('id, description')
      .in('id', chunk);
    if (error) throw new Error(`Supabase models: ${error.message}`);
    for (const row of data || []) {
      if (!isEmpty(row.description)) map.set(row.id, row.description);
    }
  }
  return map;
}

async function patchDescription(sku, description) {
  const res = await fetch(`${VPS_BASE}/products/description`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_SECRET },
    body: JSON.stringify({ sku, description }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.error || ''}`);
  return json;
}

(async () => {
  console.log(`[backfill] modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[backfill] VPS: ${VPS_BASE}`);

  const products = await fetchAllProducts();
  console.log(`[backfill] produtos lidos: ${products.length}`);

  const missing = products.filter(p => isEmpty(p.description));
  console.log(`[backfill] sem descrição: ${missing.length}`);

  // Construir índice de irmãos com descrição: bling_parent_id -> descrição preenchida
  const siblingDesc = new Map();
  for (const p of products) {
    if (!p.bling_parent_id || isEmpty(p.description)) continue;
    if (!siblingDesc.has(p.bling_parent_id)) {
      siblingDesc.set(p.bling_parent_id, p.description);
    }
  }

  // Coletar model_ids de produtos sem descrição pra buscar no Supabase
  const modelIds = missing.map(p => p.model_id).filter(Boolean);
  console.log(`[backfill] consultando ${new Set(modelIds).size} modelos no Supabase…`);
  const modelDesc = await getModelDescriptionsByIds(modelIds);
  console.log(`[backfill] modelos com description preenchida: ${modelDesc.size}`);

  const plan = [];
  const skipped = [];
  for (const p of missing) {
    let source = null;
    let desc = null;
    if (p.bling_parent_id && siblingDesc.has(p.bling_parent_id)) {
      source = 'sibling';
      desc = siblingDesc.get(p.bling_parent_id);
    } else if (p.model_id && modelDesc.has(p.model_id)) {
      source = 'model';
      desc = modelDesc.get(p.model_id);
    }
    if (desc && p.sku) {
      plan.push({ id: p.id, sku: p.sku, name: p.name, source, length: desc.length, desc });
    } else {
      skipped.push({ id: p.id, sku: p.sku || '(sem sku)', name: p.name, reason: !p.sku ? 'sem sku' : 'sem fonte' });
    }
  }

  console.log(`\n[backfill] PLANO`);
  console.log(`  via irmão: ${plan.filter(x => x.source === 'sibling').length}`);
  console.log(`  via modelo: ${plan.filter(x => x.source === 'model').length}`);
  console.log(`  total resolvíveis: ${plan.length}`);
  console.log(`  ignorados (sem fonte ou sem sku): ${skipped.length}`);

  console.log(`\n  primeiros 10 do plano:`);
  for (const item of plan.slice(0, 10)) {
    console.log(`  [${item.source}] ${item.sku.padEnd(15)} (${item.length} chars) ${item.name.slice(0, 60)}`);
  }
  console.log(`\n  primeiros 10 ignorados:`);
  for (const item of skipped.slice(0, 10)) {
    console.log(`  [${item.reason}] ${item.sku.padEnd(15)} ${item.name.slice(0, 60)}`);
  }

  if (!apply) {
    console.log(`\n[backfill] dry-run completo. Rode novamente com --apply pra executar.`);
    return;
  }

  console.log(`\n[backfill] aplicando ${plan.length} PATCHes...`);
  let ok = 0, fail = 0;
  for (const item of plan) {
    try {
      await patchDescription(item.sku, item.desc);
      ok += 1;
      if (ok % 20 === 0) console.log(`  progresso: ${ok}/${plan.length}`);
    } catch (err) {
      fail += 1;
      console.error(`  falhou ${item.sku}: ${err.message}`);
    }
  }
  console.log(`\n[backfill] feito. ok=${ok} fail=${fail}`);
})().catch(err => { console.error('ERRO:', err); process.exit(1); });
