/**
 * Adds product brands to tags_venda and ensures the cross_sell_tags dictionary
 * through the protected VPS API. Dry-run by default; pass --apply to execute.
 */
require('dotenv').config();

const VPS_BASE = (process.env.VITE_VPS_BASE_URL || process.env.VITE_VPS_URL || 'https://api.xiaomipetrolina.com.br').replace(/\/+$/, '');
const SYNC_SECRET = process.env.SYNC_SECRET || process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';
const apply = process.argv.includes('--apply');

if (!SYNC_SECRET) { console.error('SYNC_SECRET/VPS_SYNC_KEY ausente no .env'); process.exit(1); }

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

function normalizeTag(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function tagsArray(raw) {
    if (Array.isArray(raw)) return raw.filter(t => typeof t === 'string' && t.trim());
    if (typeof raw === 'string' && raw.trim().startsWith('[')) {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p.filter(t => typeof t === 'string' && t.trim()) : [];
        } catch { /* ignore malformed JSON */ }
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
        const requestFetch = await getFetch();
        const res = await requestFetch(`${VPS_BASE}/products?status=all&limit=${pageSize}&offset=${page * pageSize}`);
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
    const all = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsFetch(`/table-data/cross_sell_tags?limit=${pageSize}&offset=${offset}`);
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        all.push(...rows);
        if (rows.length < pageSize) break;
    }
    return all;
}

async function ensureDictionaryTag(name) {
    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return vpsFetch('/table-data/cross_sell_tags', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), slug }),
    });
}

async function patchTagsVenda(productId, tagsVenda) {
    return vpsFetch(`/products/${productId}/tags-venda`, {
        method: 'PATCH',
        body: JSON.stringify({ tags_venda: tagsVenda }),
    });
}

(async () => {
    console.log(`[brand-tags] modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

    const products = await fetchAllProducts();
    console.log(`[brand-tags] produtos lidos: ${products.length}`);

    const brandsByNorm = new Map();
    for (const p of products) {
        const b = (p.brand || '').trim();
        if (!b) continue;
        const n = normalizeTag(b);
        if (!brandsByNorm.has(n)) brandsByNorm.set(n, b);
    }
    console.log(`[brand-tags] marcas unicas: ${brandsByNorm.size}`);

    const dict = await loadDictionary();
    const dictNorm = new Set(dict.map(t => normalizeTag(t.name)));
    const dictMissing = [];
    for (const [n, name] of brandsByNorm) {
        if (!dictNorm.has(n)) dictMissing.push(name);
    }
    console.log(`[brand-tags] marcas faltando no dicionario: ${dictMissing.length}`);
    if (dictMissing.length > 0) {
        console.log('  ->', dictMissing.slice(0, 10).join(', '), dictMissing.length > 10 ? '...' : '');
    }

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
        console.log(`  ${item.sku.padEnd(15)} [${item.brand}] -> tags_venda: [${item.newTags.join(', ')}]`);
    }

    if (!apply) {
        console.log(`\n[brand-tags] dry-run. Rode com --apply pra executar.`);
        return;
    }

    console.log(`\n[brand-tags] inserindo ${dictMissing.length} marcas no dicionario...`);
    for (const name of dictMissing) {
        try {
            await ensureDictionaryTag(name);
            console.log(`  ok ${name}`);
        } catch (err) {
            console.error(`  falhou ${name}: ${err.message}`);
        }
    }

    console.log(`\n[brand-tags] aplicando ${plan.length} PATCHes...`);
    let ok = 0, fail = 0;
    for (const item of plan) {
        try {
            await patchTagsVenda(item.id, item.newTags);
            ok += 1;
            if (ok % 50 === 0) console.log(`  progresso: ${ok}/${plan.length}`);
        } catch (err) {
            fail += 1;
            console.error(`  falhou ${item.sku}: ${err.message}`);
        }
    }
    console.log(`\n[brand-tags] feito. ok=${ok} fail=${fail}`);
})().catch(err => { console.error('ERRO:', err); process.exit(1); });
