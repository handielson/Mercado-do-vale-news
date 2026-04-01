/**
 * restore_pmcs_kits.cjs
 * Restaura pontualmente o campo `kits` do produto PMCS na VPS.
 * Não toca em nenhum outro produto nem campo.
 *
 * Uso: node restore_pmcs_kits.cjs
 */

require('dotenv').config({ path: ['.env.local', '.env'] });

const vpsUrl = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const syncKey = process.env.VITE_VPS_SYNC_KEY;

// ID do produto PMCS na VPS (confirmado via API)
const PMCS_ID = 'f0e2597e-9d42-49f0-b761-eacf016a85dc';

// Kits do PMCS: opções de quantidade com preço por quantidade
// ⚠️ Ajuste os preços abaixo se necessário antes de rodar
const kits = [
  { quantity: 3,  price: 1350, price_wholesale: 900,  price_reseller: 1170, name: '3 meses' },
  { quantity: 6,  price: 1200, price_wholesale: 800,  price_reseller: 1040, name: '6 meses' },
  { quantity: 12, price: 1000, price_wholesale: 700,  price_reseller: 870,  name: '12 meses' },
];

async function run() {
  console.log('=== RESTAURANDO KITS DO PMCS ===');
  console.log('Produto: Mensalidade de servidor alternativo (SKU: PMCS)');

  // 1. Busca o produto atual para não sobrescrever nenhum campo além de kits
  console.log('\n1. Buscando produto atual na VPS...');
  const getRes = await fetch(`${vpsUrl}/products/${PMCS_ID}`);
  if (!getRes.ok) {
    console.error('Erro ao buscar produto:', await getRes.text());
    return;
  }
  const product = await getRes.json();
  console.log(`   Encontrado: ${product.name} (SKU: ${product.sku})`);
  console.log(`   Kits atuais: ${JSON.stringify(product.kits)}`);

  // 2. Atualiza via PUT enviando o produto completo com os kits restaurados
  console.log('\n2. Enviando restauração dos kits...');
  const payload = { ...product, kits };

  const putRes = await fetch(`${vpsUrl}/products/${PMCS_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': syncKey },
    body: JSON.stringify(payload),
  });

  if (putRes.ok) {
    console.log('✅ Kits do PMCS restaurados com sucesso!');
  } else {
    console.error('❌ Erro ao restaurar:', await putRes.text());
  }
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
