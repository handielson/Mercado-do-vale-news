import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function fixModelIds() {
  const vpsUrl = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
  const syncKey = process.env.VITE_VPS_SYNC_KEY;

  if (!syncKey) {
    console.error('❌ Erro: VITE_VPS_SYNC_KEY não encontrado no .env.local');
    return;
  }

  const skusToFix = ['MM-T112', 'MCCTS', 'MQ-7304'];

  console.log(`Conectando à API da VPS: ${vpsUrl}...`);

  for (const sku of skusToFix) {
    try {
      console.log(`\n🔍 Buscando modelo ${sku}...`);
      
      // Busca produto pelo SKU via GET
      const getRes = await fetch(`${vpsUrl}/products?search=${sku}`);
      const getResult = await getRes.json();
      
      const product = getResult.find(p => p.sku === sku);
      
      if (!product) {
        console.log(`⚠️ SKU ${sku} não encontrado.`);
        continue;
      }

      console.log(`✓ Encontrado com ID: ${product.id}. Atualizando model_id para nulo...`);

      // Remove / anula o model_id
      product.model_id = null;

      // Despacha o produto atualizado via PUT
      const putRes = await fetch(`${vpsUrl}/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-key': syncKey
        },
        body: JSON.stringify(product)
      });

      if (putRes.ok) {
        console.log(`✅ ${sku} atualizado com sucesso e desmembrado!`);
      } else {
        const errText = await putRes.text();
        console.error(`❌ Falha ao atualizar ${sku}:`, errText);
      }
      
    } catch (e) {
      console.error(`❌ Erro no SKU ${sku}:`, e.message);
    }
  }

  console.log('\n✅ Script finalizado! Por favor verifique a loja.');
}

fixModelIds();
