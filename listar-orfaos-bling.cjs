/**
 * listar-orfaos-bling.cjs
 *
 * Lista produtos ÓRFÃOS: existem no Supabase com `bling_id` mas NÃO existem na VPS.
 * Esses produtos aparecem como "JÁ IMPORTADO" no painel Bling mas não aparecem em /admin/products,
 * porque a listagem lê da VPS (fonte da verdade).
 *
 * READ-ONLY. Não escreve nada — apenas lista e salva em `orfaos-bling.json` para revisão.
 *
 * Uso:
 *   node listar-orfaos-bling.cjs
 *
 * Output:
 *   - Resumo no console
 *   - orfaos-bling.json com detalhes para revisão antes de executar a recuperação
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Variáveis do Supabase não configuradas (.env.local).');
    process.exit(1);
}
if (!SYNC_KEY) {
    console.error('❌ VITE_VPS_SYNC_KEY não configurada (.env.local).');
    process.exit(1);
}

async function fetchVpsAll() {
    const all = [];
    let offset = 0;
    const pageSize = 300;
    while (true) {
        const res = await fetch(`${VPS_BASE}/products?limit=${pageSize}&offset=${offset}&status=all`, {
            headers: { 'X-Sync-Key': SYNC_KEY },
        });
        if (!res.ok) throw new Error(`VPS retornou ${res.status}: ${await res.text()}`);
        const page = await res.json();
        if (!Array.isArray(page) || page.length === 0) break;
        all.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
    }
    return all;
}

async function fetchSupabaseWithBlingId() {
    const all = [];
    let from = 0;
    const pageSize = 200;
    while (true) {
        const to = from + pageSize - 1;
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/products?select=id,sku,bling_id,bling_parent_id,name,model_id,status,stock_quantity,price_retail,created_at,updated_at&bling_id=not.is.null&order=created_at.desc`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    Range: `${from}-${to}`,
                    'Range-Unit': 'items',
                    Prefer: 'count=none',
                },
            },
        );
        if (!res.ok) throw new Error(`Supabase retornou ${res.status}: ${await res.text()}`);
        const page = await res.json();
        if (!Array.isArray(page) || page.length === 0) break;
        all.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

async function main() {
    console.log('🔍 Buscando produtos...');
    console.log(`   VPS:      ${VPS_BASE}`);
    console.log(`   Supabase: ${SUPABASE_URL}\n`);

    const [vps, supa] = await Promise.all([fetchVpsAll(), fetchSupabaseWithBlingId()]);
    console.log(`📦 VPS: ${vps.length} produtos totais`);
    console.log(`📦 Supabase: ${supa.length} produtos com bling_id\n`);

    // Índices da VPS por id e bling_id
    const vpsById = new Map(vps.map(p => [String(p.id), p]));
    const vpsByBlingId = new Map(
        vps.filter(p => p.bling_id != null).map(p => [String(p.bling_id), p]),
    );

    // Órfão = está no Supabase mas NÃO na VPS (nem por id nem por bling_id).
    // Considera que a VPS é a fonte da verdade usada pela listagem /admin/products.
    const orfaos = [];
    const orfaosSemModelo = [];
    const orfaosDraft = [];

    for (const sp of supa) {
        const naoTemPorId = !vpsById.has(String(sp.id));
        const naoTemPorBlingId = !vpsByBlingId.has(String(sp.bling_id));
        if (naoTemPorId && naoTemPorBlingId) {
            const record = {
                id: sp.id,
                sku: sp.sku,
                bling_id: sp.bling_id,
                bling_parent_id: sp.bling_parent_id,
                name: sp.name,
                model_id: sp.model_id,
                status: sp.status,
                stock_quantity: sp.stock_quantity,
                price_retail: sp.price_retail,
                created_at: sp.created_at,
                updated_at: sp.updated_at,
            };
            if (sp.status === 'draft') {
                orfaosDraft.push(record);
            } else if (sp.model_id == null) {
                orfaosSemModelo.push(record);
            } else {
                orfaos.push(record);
            }
        }
    }

    // Resumo
    console.log('════════════════════════════════════════');
    console.log('📊 ÓRFÃOS ENCONTRADOS');
    console.log('════════════════════════════════════════');
    console.log(`  ✅ Recuperáveis (ativos, com model_id):  ${orfaos.length}`);
    console.log(`  ⚠️  Sem model_id (precisa associar):      ${orfaosSemModelo.length}`);
    console.log(`  ⏭️  Drafts/pais estruturais (ignorar):    ${orfaosDraft.length}`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Total:                                   ${orfaos.length + orfaosSemModelo.length + orfaosDraft.length}\n`);

    // Amostras
    if (orfaos.length > 0) {
        console.log('📋 Amostras recuperáveis (primeiros 10):');
        orfaos.slice(0, 10).forEach(p =>
            console.log(
                `  • [${p.sku || 'sem-sku'}] ${String(p.name || '').slice(0, 50)} | bling_id=${p.bling_id} | estoque=${p.stock_quantity} | R$ ${p.price_retail}`,
            ),
        );
        console.log('');
    }

    if (orfaosSemModelo.length > 0) {
        console.log('⚠️  Amostras sem model_id (primeiros 5):');
        orfaosSemModelo.slice(0, 5).forEach(p =>
            console.log(`  • [${p.sku || 'sem-sku'}] ${String(p.name || '').slice(0, 50)} | bling_id=${p.bling_id}`),
        );
        console.log('');
    }

    // Grava JSON para análise
    const outPath = path.join(__dirname, 'orfaos-bling.json');
    fs.writeFileSync(
        outPath,
        JSON.stringify(
            {
                generated_at: new Date().toISOString(),
                totais: {
                    vps: vps.length,
                    supabase_com_bling_id: supa.length,
                    orfaos_recuperaveis: orfaos.length,
                    orfaos_sem_modelo: orfaosSemModelo.length,
                    orfaos_draft: orfaosDraft.length,
                },
                recuperaveis: orfaos,
                sem_modelo: orfaosSemModelo,
                draft: orfaosDraft,
            },
            null,
            2,
        ),
        'utf8',
    );

    console.log(`💾 Detalhes salvos em: ${outPath}`);
    console.log(`\n✅ Diagnóstico concluído. Revise o JSON antes de executar a recuperação.`);
}

main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});
