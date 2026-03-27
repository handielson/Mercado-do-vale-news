const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const vpsBase = 'https://api.xiaomipetrolina.com.br';
const syncKey = process.env.VITE_VPS_SYNC_KEY || process.env.VPS_SYNC_KEY;

async function run() {
  console.log('Fetching all products from Supabase...');
  const { data: supaProducts, error } = await supabase.from('products').select('*');
  if (error) {
    console.error('Supabase error:', error);
    return;
  }
  
  console.log(`Found ${supaProducts.length} products. Checking VPS for missing bling_id...`);
  
  const vpsRes = await fetch(`${vpsBase}/products?limit=5000`);
  const vpsProducts = await vpsRes.json();
  const vpsMap = new Map((vpsProducts || []).map(p => [p.id, p]));
  
  let fixedCount = 0;

  for (const sp of supaProducts) {
    const vp = vpsMap.get(sp.id);
    // If VPS is missing the product, OR if Supabase has bling_id but VPS lost it due to the wipe bug
    if (!vp || (sp.bling_id && !vp.bling_id)) {
      console.log(`Fixing product ${sp.sku} (${sp.name})...`);
      
      const payload = {
        id: sp.id,
        model_id: sp.model_id,
        parent_id: sp.parent_id,
        brand: sp.brand,
        category_id: sp.category_id,
        name: sp.name,
        sku: sp.sku,
        description: sp.description,
        ean: sp.eans?.[0],
        alternative_eans: sp.eans || [],
        specs: sp.specs || {},
        price_cost: sp.price_cost,
        price_retail: sp.price_retail,
        price_reseller: sp.price_reseller,
        price_wholesale: sp.price_wholesale,
        images: sp.images || [],
        ncm: sp.ncm,
        cest: sp.cest,
        origin: sp.origin,
        weight_kg: sp.weight_kg,
        dimensions: sp.dimensions,
        stock_quantity: sp.stock_quantity,
        status: sp.status,
        track_inventory: sp.track_inventory ? 1 : 0,
        is_gift: sp.is_gift ? 1 : 0,
        warranty_type: sp.warranty_type,
        warranty_template_id: sp.warranty_template_id,
        price_promo: sp.price_promo,
        promo_start: sp.promo_start,
        promo_end: sp.promo_end,
        bling_id: sp.bling_id,
        bling_parent_id: sp.bling_parent_id,
        shopee_item_id: sp.shopee_item_id,
        video_url: sp.video_url,
        slug: sp.slug,
      };

      const putRes = await fetch(`${vpsBase}/products/${sp.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Key': syncKey
        },
        body: JSON.stringify(payload)
      });

      if (!putRes.ok) {
        console.error(`Failed to fix ${sp.sku}: ${putRes.status}`);
      } else {
        fixedCount++;
      }
    }
  }

  console.log(`Done. Fixed ${fixedCount} products on the VPS.`);
}

run();
