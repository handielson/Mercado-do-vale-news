/**
 * sync-template-specs.cjs
 * Resolve campos de template ausentes nas especificações dos produtos.
 *
 * Como funciona:
 * 1. Busca produtos na tabela `products` do Supabase e faz um JOIN com `models` para pegar os `template_values`.
 * 2. Faz um merge (mesclagem) de: template.values_do_modelo + custom_fields + specs_existente.
 * 3. Envia o objeto `specs` completo e consolidado para a VPS.
 * 4. (Opcional - mas recomendado) Atualiza a tabela `products.specs` no próprio Supabase para já ficar consolidado lá.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const VPS_BASE    = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY    = process.env.VITE_VPS_SYNC_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !SYNC_KEY) {
  console.error('❌ Variáveis necessárias ausentes no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function patchProductSpecsVPS(sku, description, specs) {
  const res = await fetch(`${VPS_BASE}/products/description`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Key': SYNC_KEY,
    },
    body: JSON.stringify({ sku, description, specs }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`VPS ${res.status}: ${body.substring(0, 120)}`);
  }
  return res.json();
}

async function syncModelTemplates() {
  console.log('📦 Buscando produtos com templates de modelos no Supabase...');
  
  // Pegamos todos os produtos sem paginação manual para simplificar (assume-se < 5000)
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id, sku, description, specs,
      model:models!fk_products_model_id(template_values)
    `)
    .not('model_id', 'is', null) // Apenas os que possuem um modelo vinculado
    .order('id');
    
  if (error) {
    console.error('Erro ao buscar do Supabase:', error);
    return;
  }

  console.log(`\n✅ ${products.length} produtos encontrados vinculados a um Modelo. Processando...`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of products) {
    const sku = product.sku;
    if (!sku) { skipped++; continue; }

    const templateValues = product.model?.template_values || {};
    const existingSpecs = product.specs || {};

    // Mergem a ordem importa: template -> specs
    // O que o usuário salvou em specs por último se sobressai!
    const mergedSpecs = {
        ...templateValues,
        ...existingSpecs 
    };

    // Pula se já for idêntico (opcional, vamos mandar para a VPS de qualquer forma para garantir o Sync)
    // Mas vamos atualizar o Supabase
    
    process.stdout.write(`  Syncing ${sku}... `);
    try {
        // Atualiza Supabase permanentemente com o merged json
        const { error: updateError } = await supabase
            .from('products')
            .update({ specs: mergedSpecs })
            .eq('id', product.id);
            
        if (updateError) {
             console.log(`❌ Supabase Erro: ${updateError.message}`);
             errors++;
             continue;
        }

        // Atualiza a VPS usando nosso novo endpoint PATCH
        await patchProductSpecsVPS(sku, product.description, mergedSpecs);

        console.log('✅');
        synced++;
    } catch (e) {
        console.log(`❌ VPS Falha: ${e.message}`);
        errors++;
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`✅ Consolidação de Specs + Template Concluída!`);
  console.log(`✅ Sincronizados na VPS/Supa: ${synced}`);
  console.log(`⚠️  Pulados (sem SKU): ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
  console.log(`════════════════════════════════════════\n`);
}

syncModelTemplates();
