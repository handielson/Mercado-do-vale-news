/**
 * Fills empty product descriptions using VPS data only.
 * Sources: sibling product with same bling_parent_id, then models.description
 * read through protected /table-data/models. Dry-run by default.
 */
require('dotenv').config();

const VPS_BASE = (process.env.VITE_VPS_BASE_URL || process.env.VITE_VPS_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const SYNC_SECRET = process.env.SYNC_SECRET || process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';
const apply = process.argv.includes('--apply');

if (!SYNC_SECRET) { console.error('SYNC_SECRET/VPS_SYNC_KEY ausente no .env'); process.exit(1); }

const isEmpty = (s) => {
    if (!s || typeof s !== 'string') return true;
    const trimmed = s.trim();
    if (!trimmed) return true;
    const text = trimmed.replace(/<[^>]+>/g, '').trim();
    if (!text) return true;
    if (text.length < 5) return true;
    if (/^[0-9\s]+$/.test(text)) return true;
    return false;
};

async function getFetch() {
  if (typeof fetch === 'function') return fetch;
  const mod = await import('node-fetch');
  return mod.default;
}

async function vpsFetch(pathname, options = {}) {
  const requestFetch = await getFetch();
  const res = await requestFetch(`${VPS_BASE}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-sync-key': SYNC_SECRET,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.error || text || ''}`);
  return json;
}

async function fetchAllProducts() {
  const all = [];
  let page = 0;
  const pageSize = 2000;
  while (true) {
    const requestFetch = await getFetch();
    const res = await requestFetch(`${VPS_BASE}/products?status=all&limit=${pageSize}&offset=${page * pageSize}`);
    if (!res.ok) throw new Error(`Falha ao listar produtos: ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    page += 1;
  }
  return all;
}

async function fetchAllModels() {
  const pageSize = 200;
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const data = await vpsFetch(`/table-data/models?limit=${pageSize}&offset=${offset}`);
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

async function getModelDescriptionsByIds(modelIds) {
  if (modelIds.length === 0) return new Map();
  const wanted = new Set(modelIds.map(String));
  const map = new Map();
  for (const row of await fetchAllModels()) {
    if (wanted.has(String(row.id)) && !isEmpty(row.description)) {
      map.set(row.id, row.description);
    }
  }
  return map;
}

async function patchDescription(sku, description) {
  return vpsFetch('/products/description', {
    method: 'PATCH',
    body: JSON.stringify({ sku, description }),
  });
}

(async () => {
  console.log(`[backfill] modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`[backfill] VPS: ${VPS_BASE}`);

  const products = await fetchAllProducts();
  console.log(`[backfill] produtos lidos: ${products.length}`);

  const missing = products.filter(p => isEmpty(p.description));
  console.log(`[backfill] sem descricao: ${missing.length}`);

  const siblingDesc = new Map();
  for (const p of products) {
    if (!p.bling_parent_id || isEmpty(p.description)) continue;
    if (!siblingDesc.has(p.bling_parent_id)) {
      siblingDesc.set(p.bling_parent_id, p.description);
    }
  }

  const modelIds = missing.map(p => p.model_id).filter(Boolean);
  console.log(`[backfill] consultando ${new Set(modelIds).size} modelos na VPS...`);
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
  console.log(`  via irmao: ${plan.filter(x => x.source === 'sibling').length}`);
  console.log(`  via modelo: ${plan.filter(x => x.source === 'model').length}`);
  console.log(`  total resolviveis: ${plan.length}`);
  console.log(`  ignorados (sem fonte ou sem sku): ${skipped.length}`);

  console.log(`\n  primeiros 10 do plano:`);
  for (const item of plan.slice(0, 10)) {
    console.log(`  [${item.source}] ${item.sku.padEnd(15)} (${item.length} chars) ${String(item.name || '').slice(0, 60)}`);
  }
  console.log(`\n  primeiros 10 ignorados:`);
  for (const item of skipped.slice(0, 10)) {
    console.log(`  [${item.reason}] ${item.sku.padEnd(15)} ${String(item.name || '').slice(0, 60)}`);
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
