require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = 'https://api.xiaomipetrolina.com.br';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('Buscando produtos da VPS...');
  // Pega da VPS todos os produtos usando a rota compact=false mas para isso, é melhor pegar direto!
  // Como as URLs agora estão na VPS, vou só buscar de lá!
  // Espera, a VPS route /products pagina. 
  
  let all = [];
  let offset = 0;
  while(true) {
    const res = await fetch(`${VPS_BASE}/products?limit=500&offset=${offset}`);
    const data = await res.json();
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 500) break;
    offset += 500;
  }
  
  console.log(`Encontrados ${all.length} produtos na VPS.`);
  
  let synced = 0;
  for (const p of all) {
    if (!p.sku) continue;
    if (!p.images || p.images.length === 0) continue;
    
    // So update se as imagens lá agora apontam para a VPS (ou seja, não é base64)
    const hasVpsUrl = p.images.some(img => typeof img === 'string' && img.includes('xiaomipetrolina.com.br'));
    if (!hasVpsUrl) continue;

    process.stdout.write(`Atualizando ${p.sku}... `);
    const { error } = await supabase
      .from('products')
      .update({ images: p.images })
      .eq('sku', p.sku);
      
    if (error) {
      console.log('Erro:', error.message);
    } else {
      console.log('OK');
      synced++;
    }
  }
  
  console.log(`\nForam sincronizadas ${synced} imagens atualizadas de volta pro Supabase.`);
}

run().catch(console.error);
