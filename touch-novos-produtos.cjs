/**
 * touch-novos-produtos.cjs
 * Toca os N produtos mais recentes por created_at (independente de data).
 * Bumpa updated_at=NOW() para que apareçam em "Mais Recentes".
 *
 * Uso: node touch-novos-produtos.cjs [quantidade=60]
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const VPS      = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY = process.env.VITE_VPS_SYNC_KEY;
const QTD      = parseInt(process.argv[2] || '60', 10); // default: 60 (cobre os 54)

if (!SYNC_KEY) {
  console.error('❌ VITE_VPS_SYNC_KEY nao encontrada no .env.local');
  process.exit(1);
}

async function touchProduct(sku, stock_quantity) {
  const r = await fetch(`${VPS}/products/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': SYNC_KEY },
    body: JSON.stringify({ sku, stock_quantity }),
  });
  if (!r.ok) throw new Error(`VPS PATCH stock ${sku}: ${r.status}`);
  return r.json();
}

async function main() {
  console.log(`\n🔍 Buscando os ${QTD} produtos mais recentes por created_at DESC...`);

  const r = await fetch(
    `${VPS}/products?sort_by=created_at&sort_direction=desc&limit=${QTD}&status=all`
  );
  if (!r.ok) throw new Error(`VPS GET products: ${r.status}`);
  const products = await r.json();

  console.log(`📦 ${products.length} produtos encontrados\n`);
  products.forEach((p, i) => {
    const cre = new Date(p.created_at).toLocaleString('pt-BR');
    const upd = new Date(p.updated_at).toLocaleString('pt-BR');
    const isNew = cre !== upd ? '🆕' : '  ';
    console.log(`${isNew} ${String(i+1).padStart(2)}. [${cre}] ${p.sku || '?'} — ${p.name}`);
  });

  console.log(`\n🚀 Tocando ${products.length} produtos (updated_at = agora)...`);

  let ok = 0, skip = 0, err = 0;
  for (const p of products) {
    if (!p.sku) { skip++; continue; }
    process.stdout.write(`  ${p.sku}... `);
    try {
      const res = await touchProduct(p.sku, p.stock_quantity ?? 0);
      if (res.affectedRows > 0) { process.stdout.write('✅\n'); ok++; }
      else { process.stdout.write('⚠️ nao afetado\n'); skip++; }
    } catch (e) {
      process.stdout.write(`❌ ${e.message.substring(0, 60)}\n`);
      err++;
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`✅ Tocados: ${ok}`);
  console.log(`⏭️  Pulados: ${skip}`);
  console.log(`❌ Erros:   ${err}`);
  console.log('════════════════════════════════════════');
  console.log('\n✅ Recarregue a pagina inicial (Ctrl+F5) para ver os novos produtos!');
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
