require('dotenv').config({ path: ['.env.local', '.env'] });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const vpsUrl = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const syncKey = process.env.VITE_VPS_SYNC_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontradas no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('>>> ETAPA 2: MIGRANDO DADOS (Supabase -> VPS) <<<');
  
  // Buscar TODOS os produtos e colunas vitais do Supabase para não sobreescrever com NULL
  console.log('1. Buscando dados vitais de produtos no Supabase (Re-hidratando a VPS)...');
  const { data: products, error } = await supabase
    .from('products')
    .select('*, brands(name)');

  if (error || !products) {
    console.error('Erro ao buscar do supabase:', error);
    return;
  }

  console.log(`Foram localizados ${products.length} produtos para re-hidratação.`);
  console.log('2. Enviando requisições em lote para a VPS (Recuperando todos os dados)...');

  let successCount = 0;
  let errorCount = 0;

  // Enviar de 1 em 1 para não sobrecarregar Payload Too Large (base64 pictures)
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    
    // Tratamento de parse se for string json
    let images = p.images;
    if (typeof images === 'string') {
      try { images = JSON.parse(images); } catch(e) {}
    }
    
    // Parse the brand name
    let brandName = null;
    if (p.brands && typeof p.brands === 'object') {
       brandName = Array.isArray(p.brands) ? p.brands[0]?.name : p.brands.name;
    }

    // Passamos todos os campos vindo do Supabase + tratamento de imagem e marca
    const payload = {
      ...p,
      images: images,
      brand: brandName
    };
    // Remover o array de brands para limpar o payload
    delete payload.brands;

    try {
      const res = await fetch(`${vpsUrl}/products/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Sync-Key': syncKey
        },
        body: JSON.stringify([payload])
      });

      if (res.ok) {
        successCount++;
        process.stdout.write('.');
      } else {
        errorCount++;
        process.stdout.write('X');
        if (errorCount === 1) {
          const errMsg = await res.text();
          console.log(`\n[ERRO NA VPS] HTTP ${res.status}: ${errMsg}`);
        }
      }
    } catch (err) {
      errorCount++;
      process.stdout.write('X');
    }
  }

  console.log(`\n\nMigração concluída!`);
  console.log(`✅ Sucesso: ${successCount} produtos`);
  console.log(`❌ Falha: ${errorCount} produtos`);
  
  if (successCount > 0) {
    console.log('\nTodos os dados de texto, especificações, kits e imagens foram fundidos na VPS.');
    console.log('A VPS agora é o coração único da operação de catálogo e estoque!');
    console.log('Por favor avise o Antigravity que a migração foi concluída para irmos à Etapa 3 (virar a chave no código).');
  }
}

run();
