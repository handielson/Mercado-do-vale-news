/**
 * testar-patch-imagem.cjs
 * Testa o endpoint PATCH /products/images com 1 SKU conhecido (ATXAI).
 * Mostra o status HTTP e a resposta crus.
 * Uso: node testar-patch-imagem.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const VPS_BASE = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY = process.env.VITE_VPS_SYNC_KEY;

const SKU_TEST = 'ATXAI'; // SKU que sabemos que existe nos dois

async function main() {
  console.log(`\n🧪 Testando PATCH /products/images com SKU: ${SKU_TEST}\n`);

  // 1. Verifica se o produto existe na VPS
  console.log('1. GET /products?sku=ATXAI');
  const getRes = await fetch(`${VPS_BASE}/products?sku=${SKU_TEST}&status=all`, {
    headers: { 'X-Sync-Key': SYNC_KEY }
  });
  const getBody = await getRes.json();
  console.log(`   Status: ${getRes.status}`);
  if (Array.isArray(getBody) && getBody.length > 0) {
    const p = getBody[0];
    console.log(`   Encontrado: id="${p.id}" | sku="${p.sku}" | images="${JSON.stringify(p.images).slice(0,60)}..."`);
  } else {
    console.log(`   Resposta: ${JSON.stringify(getBody).slice(0, 200)}`);
  }

  // 2. Testa PATCH com uma imagem fake pequena
  console.log('\n2. PATCH /products/images com imagem teste');
  const fakeImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // 1x1 pixel
  const patchRes = await fetch(`${VPS_BASE}/products/images`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': SYNC_KEY
    },
    body: JSON.stringify({ sku: SKU_TEST, images: [fakeImage] })
  });
  const patchBody = await patchRes.text();
  console.log(`   Status HTTP: ${patchRes.status}`);
  console.log(`   Resposta: ${patchBody.slice(0, 300)}`);

  if (patchRes.status === 200) {
    let parsed;
    try { parsed = JSON.parse(patchBody); } catch {}
    if (parsed?.affectedRows > 0) {
      console.log(`\n   ✅ FUNCIONOU! affectedRows=${parsed.affectedRows}`);
    } else if (parsed?.affectedRows === 0) {
      console.log(`\n   ⚠️  affectedRows=0 → SKU existe mas UPDATE não afetou linhas`);
      console.log(`   Possível causa: SKU no MySQL tem capitalização diferente?`);
    }
  } else if (patchRes.status === 404) {
    console.log(`\n   ❌ Endpoint não existe no VPS deployado (404)`);
    console.log(`   → Você precisa fazer o deploy do vps_server.js atualizado`);
  } else if (patchRes.status === 401 || patchRes.status === 403) {
    console.log(`\n   ❌ Problema de autenticação — checar SYNC_KEY`);
  } else {
    console.log(`\n   ❌ Erro inesperado: ${patchRes.status}`);
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
