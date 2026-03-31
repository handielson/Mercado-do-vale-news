/**
 * delete-empty-sku.cjs
 * Deleta do Supabase produtos que estejam sem SKU.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variáveis necessárias ausentes no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deleteEmptySku() {
  console.log('🗑️ Apagando produtos sem SKU do Supabase...');
  
  // Buscar os que têm SKU nulo ou vazio
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name')
    .or('sku.is.null,sku.eq.');
    
  if (error) {
    console.error('Erro ao buscar:', error);
    return;
  }

  if (products.length === 0) {
    console.log('✅ Nenhum produto sem SKU encontrado.');
    return;
  }

  console.log(`Encontrados ${products.length} produtos sem SKU. Deletando...`);

  for (const product of products) {
    console.log(`  Deletando "${product.name}" (ID: ${product.id})...`);
    
    // Deleta do Supabase
    const { error: delError } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);
      
    if (delError) {
      console.log(`  ❌ Falha Supabase: ${delError.message}`);
    } else {
      console.log(`  ✅ Deletado Supabase!`);
    }

    // Deleta da VPS (caso esteja lá por algum motivo)
    const VPS_BASE = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
    const SYNC_KEY = process.env.VITE_VPS_SYNC_KEY;
    try {
      const vpsRes = await fetch(`${VPS_BASE}/products/${product.id}`, {
        method: 'DELETE',
        headers: { 'X-Sync-Key': SYNC_KEY }
      });
      if (vpsRes.ok) {
        console.log(`  ✅ Deletado VPS!`);
      } else {
        console.log(`  ⚠️ VPS retornou falha ou não encontrou: ${vpsRes.status}`);
      }
    } catch(e) { /* silent on vps error */ }
  }

  console.log('\nPronto!');
}

deleteEmptySku();
