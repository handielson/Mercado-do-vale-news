require('dotenv').config({ path: ['.env.local', '.env'] });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);
const vpsUrl = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const syncKey = process.env.VITE_VPS_SYNC_KEY;

async function getBlingToken() {
  const { data: settings } = await supabase
    .from('company_settings')
    .select('bling_access_token, bling_refresh_token, bling_client_id, bling_client_secret')
    .single();
  return settings;
}

async function runRescue() {
  console.log('>>> INICIANDO O RESGATE DE EMERGÊNCIA (BLING -> VPS) <<<');
  
  const settings = await getBlingToken();
  if (!settings || !settings.bling_access_token) {
    console.error('Erro: Token do Bling não encontrado!');
    return;
  }
  let token = settings.bling_access_token;
  
  console.log('1. Buscando todos os produtos atuais na VPS...');
  const vpsRes = await fetch(`${vpsUrl}/products?status=all&limit=5000`);
  if (!vpsRes.ok) {
    console.error('Erro ao acessar VPS:', await vpsRes.text());
    return;
  }
  const vpsProducts = await vpsRes.json();
  console.log(`VPS retornou ${vpsProducts.length} produtos.`);
  
  const vpsByBlingId = new Map();
  const vpsByName = new Map();
  vpsProducts.forEach(p => {
    if (p.bling_id) vpsByBlingId.set(String(p.bling_id), p);
    vpsByName.set(p.name.trim().toLowerCase(), p);
  });
  
  console.log('2. Baixando catálogo completo do Bling ERP...');
  let hasMore = true;
  let page = 1;
  let restoredCount = 0;
  let pendingUpdates = [];

  while (hasMore) {
    console.log(`Buscando pagina ${page} do Bling...`);
    const blingRes = await fetch(`https://api.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    
    if (!blingRes.ok) {
        console.error(`Erro no Bling (Status ${blingRes.status}):`, await blingRes.text());
        break;
    }
    
    const blingData = await blingRes.json();
    const items = blingData.data || [];
    if (items.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const b of items) {
       // Tenta achar pelo bling_id (codigo de cadastro original) ou pelo nome (fallback de seguranca)
       let vpsTarget = vpsByBlingId.get(String(b.id)) || vpsByName.get(b.nome.trim().toLowerCase());
       
       if (vpsTarget) {
         // Se estragamos o preco ou SKU na VPS, vamos recuperar agora
         if (!vpsTarget.sku || vpsTarget.sku === 'null' || !vpsTarget.price_retail || vpsTarget.price_retail == 0) {
             const payload = {
                 ...vpsTarget,
                 sku: b.codigo || vpsTarget.sku,
                 price_retail: b.preco || vpsTarget.price_retail,
                 price_cost: b.precoCusto || vpsTarget.price_cost,
                 // O Bling manda a descricao curta/longa. Se a do VPS estiver vazia, salvamos a do Bling.
                 description: vpsTarget.description && vpsTarget.description !== 'null' ? vpsTarget.description : (b.descricaoCurta || b.descricaoComplementar || null),
                 bling_id: b.id
             };
             
             // Removemos 'kits' ou outros campos grandes que deram problema
             // E forçamos um UPSERT seguro apenas resgatando os campos financeiros
             pendingUpdates.push(payload);
         }
       }
    }
    page++;
  }
  
  if (pendingUpdates.length > 0) {
      console.log(`3. Enviando ${pendingUpdates.length} produtos REGATADOS para a VPS...`);
      const batchRes = await fetch(`${vpsUrl}/products/batch`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Sync-Key': syncKey },
         body: JSON.stringify(pendingUpdates)
      });
      if (batchRes.ok) {
          console.log(`✅ SUCESSO! Recuperamos ${pendingUpdates.length} produtos (SKU e Preços)!`);
      } else {
          console.error('Falha ao restaurar:', await batchRes.text());
      }
  } else {
      console.log('Nenhum dado pendente de restauração identificado pelo padrão do Bling.');
  }
}

runRescue().catch(console.error);
