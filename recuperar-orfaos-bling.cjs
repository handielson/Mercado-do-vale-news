/**
 * recuperar-orfaos-bling.cjs
 *
 * Recupera produtos órfãos do Bling: os que existem no Supabase com bling_id
 * mas sumiram da VPS. Reenvia via POST /products/batch (upsert).
 *
 * Fluxo:
 *   1. Lê a lista de órfãos de `orfaos-bling.json` (gerada por `listar-orfaos-bling.cjs`).
 *   2. Busca o payload completo de cada órfão no Supabase.
 *   3. Envia em lotes de 1 (mesma estratégia do migrate original — evita 413 Payload Too Large).
 *   4. Gera `recuperar-orfaos-result.json` com sucessos e falhas.
 *
 * SEGURO POR DEFAULT: dry-run. Para executar de verdade passe `--execute`.
 *
 * Uso:
 *   node recuperar-orfaos-bling.cjs            # dry-run (não envia nada)
 *   node recuperar-orfaos-bling.cjs --execute  # envia para VPS
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;

const EXECUTE = process.argv.includes('--execute');
const BATCH_SIZE = 1; // Mesmo valor do migrate original — evita 413 com imagens base64.

if (!SUPABASE_URL || !SUPABASE_KEY || !SYNC_KEY) {
    console.error('❌ Variáveis obrigatórias ausentes no .env.local: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (ou SERVICE_ROLE_KEY), VITE_VPS_SYNC_KEY.');
    process.exit(1);
}

const ORFAOS_JSON = path.join(__dirname, 'orfaos-bling.json');
if (!fs.existsSync(ORFAOS_JSON)) {
    console.error(`❌ ${ORFAOS_JSON} não encontrado. Rode primeiro: node listar-orfaos-bling.cjs`);
    process.exit(1);
}

async function fetchFullFromSupabase(ids) {
    // Busca em lotes de 50 IDs via .in() para evitar URLs gigantes.
    const CHUNK = 50;
    const all = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const idList = slice.map(id => `"${id}"`).join(',');
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/products?select=*&id=in.(${idList})`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    Prefer: 'count=none',
                },
            },
        );
        if (!res.ok) throw new Error(`Supabase retornou ${res.status}: ${await res.text()}`);
        const page = await res.json();
        if (Array.isArray(page)) all.push(...page);
    }
    return all;
}

async function sendToVps(products) {
    const res = await fetch(`${VPS_BASE}/products/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sync-Key': SYNC_KEY,
        },
        body: JSON.stringify(products),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`VPS retornou ${res.status}: ${text.slice(0, 300)}`);
    }
    return await res.json();
}

async function main() {
    const raw = JSON.parse(fs.readFileSync(ORFAOS_JSON, 'utf8'));
    const recuperaveis = raw.recuperaveis || [];

    console.log('════════════════════════════════════════');
    console.log(EXECUTE ? '🚀 MODO EXECUÇÃO (envia para VPS)' : '🧪 MODO DRY-RUN (não envia nada)');
    console.log('════════════════════════════════════════');
    console.log(`Órfãos recuperáveis no JSON: ${recuperaveis.length}`);
    if (recuperaveis.length === 0) {
        console.log('Nada a recuperar. Saindo.');
        return;
    }

    console.log('\n📥 Buscando payload completo no Supabase...');
    const ids = recuperaveis.map(r => r.id);
    const fullRows = await fetchFullFromSupabase(ids);
    console.log(`   ${fullRows.length} linhas carregadas do Supabase\n`);

    // Avisa se algum ID não foi encontrado (foi deletado no Supabase depois do diagnóstico).
    const foundIds = new Set(fullRows.map(r => r.id));
    const missing = ids.filter(id => !foundIds.has(id));
    if (missing.length > 0) {
        console.warn(`⚠️  ${missing.length} IDs não encontrados no Supabase (provavelmente deletados). Serão ignorados.`);
    }

    if (!EXECUTE) {
        console.log('\n🧪 DRY-RUN: não enviando para VPS.');
        console.log(`   Seriam reenviados ${fullRows.length} produtos em lotes de ${BATCH_SIZE}.`);
        console.log('\n   Amostra do 1º payload que seria enviado:');
        if (fullRows[0]) {
            const sample = { ...fullRows[0] };
            // Trunca imagens para não poluir log.
            if (Array.isArray(sample.images) && sample.images.length > 0) {
                sample.images = [`<${sample.images.length} imagens>`];
            }
            if (typeof sample.description === 'string' && sample.description.length > 200) {
                sample.description = sample.description.slice(0, 200) + '...';
            }
            console.log(JSON.stringify(sample, null, 2));
        }
        console.log('\n   Para executar de verdade: node recuperar-orfaos-bling.cjs --execute');
        return;
    }

    console.log(`\n🚀 Enviando ${fullRows.length} produtos em lotes de ${BATCH_SIZE}...\n`);

    const succeeded = [];
    const failed = [];
    const total = fullRows.length;

    for (let i = 0; i < fullRows.length; i += BATCH_SIZE) {
        const batch = fullRows.slice(i, i + BATCH_SIZE);
        const n = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(fullRows.length / BATCH_SIZE);
        const label = batch[0]?.sku || batch[0]?.id;
        process.stdout.write(`  [${n}/${totalBatches}] ${String(label).padEnd(24).slice(0, 24)} ... `);
        try {
            const result = await sendToVps(batch);
            const ok = result.upserted || 0;
            const errs = result.errors || [];
            if (errs.length > 0) {
                failed.push(...errs.map(e => ({ id: e.id, name: e.name, error: e.error })));
                console.log(`⚠️  ${ok} ok, ${errs.length} erro(s)`);
            } else {
                succeeded.push(...batch.map(b => ({ id: b.id, sku: b.sku, bling_id: b.bling_id })));
                console.log(`✅`);
            }
        } catch (err) {
            failed.push({ id: batch[0]?.id, name: batch[0]?.name, error: err.message });
            console.log(`❌ ${err.message}`);
        }
    }

    console.log('\n════════════════════════════════════════');
    console.log(`✅ Sucesso: ${succeeded.length} / ${total}`);
    console.log(`❌ Falhas:  ${failed.length}`);
    console.log('════════════════════════════════════════');

    const outPath = path.join(__dirname, 'recuperar-orfaos-result.json');
    fs.writeFileSync(
        outPath,
        JSON.stringify(
            {
                generated_at: new Date().toISOString(),
                executed: true,
                total,
                succeeded_count: succeeded.length,
                failed_count: failed.length,
                succeeded,
                failed,
            },
            null,
            2,
        ),
        'utf8',
    );
    console.log(`\n💾 Relatório: ${outPath}`);

    if (failed.length > 0) {
        console.log('\n⚠️  Falhas (primeiras 10):');
        failed.slice(0, 10).forEach(f => console.log(`   - ${f.name || f.id}: ${f.error}`));
    }
}

main().catch(err => {
    console.error('\n❌ Erro fatal:', err.message);
    process.exit(1);
});
