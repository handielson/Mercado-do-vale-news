/**
 * tools/backfill-brand-tags.cjs
 *
 * Para cada produto da VPS que tenha `brand` preenchido:
 *   1. Garante que existe uma entrada em cross_sell_tags (Supabase) com o nome
 *      da marca — match case-insensitive + accent-insensitive.
 *   2. Adiciona a marca em product.specs.tags_venda se ainda não estiver lá
 *      (mesma regra de match), via PATCH /products/:id/tags-venda na VPS.
 *
 * Uso:
 *   node tools/backfill-brand-tags.cjs           # dry-run (padrão)
 *   node tools/backfill-brand-tags.cjs --apply   # executa
 *
 * Env exigidas (.env do projeto):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (ou SUPABASE_SERVICE_ROLE_KEY),
 *   SYNC_SECRET.
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

function normalizeTag(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();
}

function tagsArray(raw) {
    if (Array.isArray(raw)) return raw.filter(t => typeof t === 'string' && t.trim());
    if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p.filter(t => typeof t === 'string' && t.trim()) : [];
        } catch { /* */ }
    }
    return [];
}

function ensureTag(existing, newTag) {
    const list = tagsArray(existing);
    const trimmed = (newTag || '').trim();
    if (!trimmed) return { list, changed: false };
    const norm = normalizeTag(trimmed);
    if (list.some(t => normalizeTag(t) === norm)) return { list, changed: false };
    return { list: [...list, trimmed], changed: true };
}

async function fetchAllProducts() {
    const all = [];
    let page = 0;
    const pageSize = 2000;
    while (true) {
        const res = await fetch(`${VPS_BASE}/products?status=all&limit=${pageSize}&offset=${page * pageSize}`);
        if (!res.ok) throw new Error(`GET /products falhou: ${res.status}`);
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) break;
        all.push(...rows);
        if (rows.length < pageSize) break;
        page += 1;
    }
    return all;
}

async function loadDictionary() {
    const { data, error } = await supabase.from('cross_sell_tags').select('id, name');
    if (error) throw new Error(`Supabase cross_sell_tags: ${error.message}`);
    return data || [];
}

async function ensureDictionaryTag(name) {
    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const { error } = await supabase
        .from('cross_sell_tags')
        .insert({ name: name.trim(), slug });
    if (error && error.code !== '23505' /* unique violation */) {
        throw new Error(`Insert cross_sell_tags '${name}': ${error.message}`);
    }
}

async function patchTagsVenda(productId, tagsVenda) {
    const res = await fetch(`${VPS_BASE}/products/${productId}/tags-venda`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_SECRET },
        body: JSON.stringify({ tags_venda: tagsVenda }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.error || ''}`);
    return json;
}

(async () => {
    console.log(`[brand-tags] modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

    const products = await fetchAllProducts();
    console.log(`[brand-tags] produtos lidos: ${products.length}`);

    // 1. Garante marcas no dicionário cross_sell_tags
    const brandsByNorm = new Map(); // norm -> nome original (primeiro encontrado)
    for (const p of products) {
        const b = (p.brand || '').trim();
        if (!b) continue;
        const n = normalizeTag(b);
        if (!brandsByNorm.has(n)) brandsByNorm.set(n, b);
    }
    console.log(`[brand-tags] marcas únicas: ${brandsByNorm.size}`);

    const dict = await loadDictionary();
    const dictNorm = new Set(dict.map(t => normalizeTag(t.name)));
    const dictMissing = [];
    for (const [n, name] of brandsByNorm) {
        if (!dictNorm.has(n)) dictMissing.push(name);
    }
    console.log(`[brand-tags] marcas faltando no dicionário: ${dictMissing.length}`);
    if (dictMissing.length > 0) {
        console.log('  →', dictMissing.slice(0, 10).join(', '), dictMissing.length > 10 ? '...' : '');
    }

    // 2. Calcula plano por produto
    const plan = [];
    const skipped = [];
    for (const p of products) {
        const brand = (p.brand || '').trim();
        if (!brand) { skipped.push({ id: p.id, sku: p.sku, reason: 'sem brand' }); continue; }
        const currentTags = tagsArray(p.specs?.tags_venda);
        const { list, changed } = ensureTag(currentTags, brand);
        if (changed) {
            plan.push({ id: p.id, sku: p.sku || '-', name: p.name, brand, newTags: list });
        }
    }

    console.log(`\n[brand-tags] PLANO`);
    console.log(`  produtos a atualizar: ${plan.length}`);
    console.log(`  ignorados (sem brand): ${skipped.length}`);
    console.log('\n  primeiros 10:');
    for (const item of plan.slice(0, 10)) {
        console.log(`  ${item.sku.padEnd(15)} [${item.brand}] → tags_venda: [${item.newTags.join(', ')}]`);
    }

    if (!apply) {
        console.log(`\n[brand-tags] dry-run. Rode com --apply pra executar.`);
        return;
    }

    // 3a. Insere marcas faltantes no dicionário
    console.log(`\n[brand-tags] inserindo ${dictMissing.length} marcas no dicionário...`);
    for (const name of dictMissing) {
        try {
            await ensureDictionaryTag(name);
            console.log(`  ✓ ${name}`);
        } catch (err) {
            console.error(`  ✗ ${name}: ${err.message}`);
        }
    }

    // 3b. Atualiza specs.tags_venda nos produtos
    console.log(`\n[brand-tags] aplicando ${plan.length} PATCHes...`);
    let ok = 0, fail = 0;
    for (const item of plan) {
        try {
            await patchTagsVenda(item.id, item.newTags);
            ok += 1;
            if (ok % 50 === 0) console.log(`  progresso: ${ok}/${plan.length}`);
        } catch (err) {
            fail += 1;
            console.error(`  ✗ ${item.sku}: ${err.message}`);
        }
    }
    console.log(`\n[brand-tags] feito. ok=${ok} fail=${fail}`);
})().catch(err => { console.error('ERRO:', err); process.exit(1); });
